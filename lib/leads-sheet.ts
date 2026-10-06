import { fetchSheetOrExcelValues, fetchSpreadsheetTabTitles } from '@/lib/google-sheets';

// Parses the public "Reporte leads ucarianos" workbook: one tab per month ("Ucarianos <mes>"),
// each tab has a "Resumen por ucariano" table followed by a "Leads diarios por ucariano" table.
// Column positions are NOT fixed (new ucarianos get appended as columns), so both tables are
// located by scanning for their header rows instead of hardcoded cell references.

export type LeadsResumenRow = {
  ucariano: string;
  auto: string;
  estado: string;
  resultados: number;
  costoResultado: number;
  importeGastado: number;
};

export type LeadsDailyRow = {
  fecha: string;
  values: Record<string, number>;
  total: number;
};

export type LeadsMonthData = {
  date: string;
  year: number;
  monthIndex: number;
  monthName: string;
  tabName: string;
  resumen: LeadsResumenRow[];
  resumenTotal: LeadsResumenRow | null;
  dailyHeaders: string[];
  dailyRows: LeadsDailyRow[];
  selectedDay: LeadsDailyRow | null;
};

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export function getMonthNameEs(monthIndex: number) {
  return MONTHS_ES[monthIndex] || '';
}

function normalizeText(value: string | undefined | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: string | undefined | null) {
  const parsed = Number((value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cell(row: string[] | undefined, index: number) {
  return (row && row[index] ? String(row[index]) : '').trim();
}

function parseIsoDate(dateIso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso || '');
  if (!match) {
    throw new Error('Fecha invalida, usa el formato YYYY-MM-DD.');
  }
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1, day: Number(match[3]) };
}

/** Finds the real tab name for a given month (tab titles aren't always capitalized the same way). */
export async function resolveMonthTabName(spreadsheetId: string, monthIndex: number) {
  const tabs = await fetchSpreadsheetTabTitles(spreadsheetId);
  const monthName = getMonthNameEs(monthIndex);
  const target = normalizeText(`ucarianos ${monthName}`);
  const match = tabs.find((tab) => normalizeText(tab) === target);

  if (!match) {
    throw new Error(
      `No se encontro la pestaña de ${monthName} ("Ucarianos ${monthName}"). Pestañas disponibles: ${tabs.join(', ') || 'ninguna'}.`
    );
  }

  return match;
}

/** Parses both tables ("Resumen por ucariano" and "Leads diarios") from a tab's raw rows. */
export function parseLeadsSheetRows(rows: string[][]) {
  const resumenHeaderIndex = rows.findIndex((row) => normalizeText(cell(row, 0)) === 'ucariano');
  if (resumenHeaderIndex === -1) {
    throw new Error('No se encontro la tabla "Resumen por ucariano" en la pestaña del mes.');
  }

  const resumen: LeadsResumenRow[] = [];
  let resumenTotal: LeadsResumenRow | null = null;
  let cursor = resumenHeaderIndex + 1;

  for (; cursor < rows.length; cursor++) {
    const row = rows[cursor];
    const firstCell = cell(row, 0);
    if (!firstCell) break;

    const entry: LeadsResumenRow = {
      ucariano: firstCell,
      auto: cell(row, 1),
      estado: cell(row, 2),
      resultados: parseNumber(cell(row, 3)),
      costoResultado: parseNumber(cell(row, 4)),
      importeGastado: parseNumber(cell(row, 5))
    };

    if (normalizeText(firstCell) === 'total') {
      resumenTotal = entry;
      cursor += 1;
      break;
    }

    resumen.push(entry);
  }

  const dailyHeaderIndex = rows.findIndex(
    (row, index) => index > resumenHeaderIndex && normalizeText(cell(row, 0)) === 'fecha'
  );
  if (dailyHeaderIndex === -1) {
    throw new Error('No se encontro la tabla "Leads diarios" en la pestaña del mes.');
  }

  const dailyHeaderRow = rows[dailyHeaderIndex];
  const totalColumnIndex = dailyHeaderRow.findIndex((value) => normalizeText(value) === 'total dia');
  const ucarianoColumns: Array<{ label: string; index: number }> = [];

  for (let col = 1; col < dailyHeaderRow.length; col++) {
    if (col === totalColumnIndex) continue;
    const label = cell(dailyHeaderRow, col);
    if (label) {
      ucarianoColumns.push({ label, index: col });
    }
  }

  const dailyRows: LeadsDailyRow[] = [];
  for (let r = dailyHeaderIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const fecha = cell(row, 0);
    if (!fecha || normalizeText(fecha) === 'total') break;

    const values: Record<string, number> = {};
    let sum = 0;
    ucarianoColumns.forEach(({ label, index }) => {
      const value = parseNumber(cell(row, index));
      values[label] = value;
      sum += value;
    });

    const total = totalColumnIndex !== -1 ? parseNumber(cell(row, totalColumnIndex)) : sum;
    dailyRows.push({ fecha, values, total });
  }

  return {
    resumen,
    resumenTotal,
    dailyHeaders: ucarianoColumns.map((item) => item.label),
    dailyRows
  };
}

function findDailyRowForDate(dailyRows: LeadsDailyRow[], year: number, monthIndex: number, day: number) {
  return (
    dailyRows.find((row) => {
      const rawDate = row.fecha.trim();
      const serial = Number(rawDate);

      if (Number.isFinite(serial) && serial > 31) {
        const excelDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
        return (
          excelDate.getUTCFullYear() === year &&
          excelDate.getUTCMonth() === monthIndex &&
          excelDate.getUTCDate() === day
        );
      }

      const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(rawDate);
      if (isoMatch) {
        return Number(isoMatch[1]) === year && Number(isoMatch[2]) === monthIndex + 1 && Number(isoMatch[3]) === day;
      }

      const localizedMatch = /^(\d{1,2})(?:\s|[-/])?(.*)$/.exec(rawDate);
      if (!localizedMatch || Number(localizedMatch[1]) !== day) return false;

      const rowMonth = normalizeText(localizedMatch[2]);
      return !rowMonth || rowMonth.includes(getMonthNameEs(monthIndex));
    }) || null
  );
}

/** Resolves the month's tab, reads it (handles the raw-Excel-in-Drive case), and finds the selected day. */
export async function fetchLeadsForDate(spreadsheetId: string, dateIso: string): Promise<LeadsMonthData> {
  const { year, monthIndex, day } = parseIsoDate(dateIso);
  const monthName = getMonthNameEs(monthIndex);
  const tabName = await resolveMonthTabName(spreadsheetId, monthIndex);
  const range = `'${tabName.replace(/'/g, "''")}'!A1:Z300`;
  const rows = await fetchSheetOrExcelValues(spreadsheetId, range);
  const parsed = parseLeadsSheetRows(rows);
  const selectedDay = findDailyRowForDate(parsed.dailyRows, year, monthIndex, day);

  return {
    date: dateIso,
    year,
    monthIndex,
    monthName,
    tabName,
    resumen: parsed.resumen,
    resumenTotal: parsed.resumenTotal,
    dailyHeaders: parsed.dailyHeaders,
    dailyRows: parsed.dailyRows,
    selectedDay
  };
}

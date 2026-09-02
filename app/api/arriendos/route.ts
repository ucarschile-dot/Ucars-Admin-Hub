import { NOTION_VERSION, resolveDataSourceId } from '@/lib/notion-data-source';

type NotionProperty = Record<string, unknown> & {
  type?: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  number?: number | null;
  formula?: { string?: string | null; number?: number | null } | null;
  date?: { start?: string | null } | null;
  relation?: Array<{ id?: string }>;
};

type NotionRow = {
  id: string;
  properties: Record<string, NotionProperty>;
};

type Arriendo = {
  id: string;
  auto: string;
  autoId: string | null;
  ucariano: string;
  ucarianoId: string | null;
  fechaInicio: string;
  fechaTermino: string;
  plazo: string;
  deadline: string;
  diasArriendoRestantes: number | null;
};

const AUTO_CANDIDATES = ['Auto', 'Vehículo', 'Vehiculo', 'Vehicle', 'Auto de interés', 'Auto de interes'];
const UCARIANO_CANDIDATES = ['Ucariano', 'Ucariano Asignado', 'Asesor', 'Advisor', 'Ejecutivo'];
const START_DATE_CANDIDATES = ['Fecha de inicio', 'Inicio', 'Fecha Inicio', 'Start Date'];
const END_DATE_CANDIDATES = ['Fecha de término', 'Fecha de termino', 'Término', 'Termino', 'Fecha fin', 'Fin', 'End Date'];
const TERM_CANDIDATES = ['Plazo', 'Termino', 'Término', 'Duración', 'Duracion', 'Term'];
const DEADLINE_CANDIDATES = ['Deadline', 'Fecha Deadline', 'Vencimiento', 'Fecha de vencimiento'];
const REMAINING_DAYS_CANDIDATES = ['Días restantes', 'Dias restantes', 'Días de arriendo restantes', 'Dias de arriendo restantes', 'Remaining Days'];

function getText(property?: NotionProperty | null) {
  if (!property) return '';
  if (Array.isArray(property.title)) return property.title.map((item) => item.plain_text || '').join('').trim();
  if (Array.isArray(property.rich_text)) return property.rich_text.map((item) => item.plain_text || '').join('').trim();
  if (property.formula?.string) return property.formula.string.trim();
  if (typeof property.formula?.number === 'number') return String(property.formula.number);
  if (property.date?.start) return property.date.start;
  if (typeof property.number === 'number') return String(property.number);
  return '';
}

function pickProperty(properties: Record<string, NotionProperty>, candidates: string[]) {
  const exact = candidates.map((candidate) => properties[candidate]).find(Boolean);
  if (exact) return exact;

  const normalizedCandidates = candidates.map(normalizeName);
  const key = Object.keys(properties).find((name) => normalizedCandidates.includes(normalizeName(name)));
  return key ? properties[key] : undefined;
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getRelationId(property?: NotionProperty | null) {
  return property?.relation?.[0]?.id || null;
}

function getDate(property?: NotionProperty | null) {
  return property?.date?.start || getText(property);
}

function getRemainingDays(endDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(endDate)) return null;
  const parts = endDate.slice(0, 10).split('-').map(Number);
  const endUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.ceil((endUtc - todayUtc) / 86400000));
}

function getNumber(property?: NotionProperty | null) {
  if (typeof property?.number === 'number') return property.number;
  if (typeof property?.formula?.number === 'number') return property.formula.number;

  const parsed = Number(getText(property).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

async function queryRows(databaseId: string, notionToken: string) {
  const dataSourceId = await resolveDataSourceId(databaseId, notionToken);
  const rows: NotionRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
      cache: 'no-store'
    });
    const payload = (await response.json()) as { results?: NotionRow[]; has_more?: boolean; next_cursor?: string | null; message?: string };
    if (!response.ok || !Array.isArray(payload.results)) {
      throw new Error(payload.message || 'No se pudo consultar Arriendos en Notion.');
    }
    rows.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor || undefined : undefined;
  } while (cursor);

  return rows;
}

async function getPageTitle(pageId: string, notionToken: string) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${notionToken}`, 'Notion-Version': NOTION_VERSION },
    cache: 'no-store'
  });
  const page = (await response.json()) as { properties?: Record<string, NotionProperty> };
  if (!response.ok || !page.properties) return pageId;
  const title = Object.values(page.properties).find((property) => property.type === 'title' && property.title?.length);
  return getText(title) || pageId;
}

async function resolveRelation(property: NotionProperty | undefined, notionToken: string) {
  const id = getRelationId(property);
  return { id, name: id ? await getPageTitle(id, notionToken) : getText(property) || 'Sin asignar' };
}

function toArriendo(row: NotionRow, auto: { id: string | null; name: string }, ucariano: { id: string | null; name: string }): Arriendo {
  const properties = row.properties;
  const fechaInicio = getDate(pickProperty(properties, START_DATE_CANDIDATES));
  const fechaTermino = getDate(pickProperty(properties, END_DATE_CANDIDATES));
  const plazo = getText(pickProperty(properties, TERM_CANDIDATES));
  const deadline = getDate(pickProperty(properties, DEADLINE_CANDIDATES));
  const remainingDaysFromNotion = getNumber(pickProperty(properties, REMAINING_DAYS_CANDIDATES));

  return {
    id: row.id,
    auto: auto.name,
    autoId: auto.id,
    ucariano: ucariano.name,
    ucarianoId: ucariano.id,
    fechaInicio,
    fechaTermino,
    plazo,
    deadline,
    diasArriendoRestantes: remainingDaysFromNotion ?? getRemainingDays(fechaTermino)
  };
}

export async function GET() {
  const databaseId = process.env.NOTION_ARRIENDOS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!databaseId || !notionToken) {
    return Response.json({ source: 'notion', arriendos: [], error: 'Faltan NOTION_API_KEY o NOTION_ARRIENDOS_DATABASE_ID.' }, { status: 503 });
  }

  try {
    const rows = await queryRows(databaseId, notionToken);
    const arriendos = await Promise.all(rows.map(async (row) => {
      const auto = await resolveRelation(pickProperty(row.properties, AUTO_CANDIDATES), notionToken);
      const ucariano = await resolveRelation(pickProperty(row.properties, UCARIANO_CANDIDATES), notionToken);
      return toArriendo(row, auto, ucariano);
    }));

    return Response.json({ source: 'notion', arriendos }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al consultar Arriendos en Notion.', error);
    return Response.json({ source: 'notion', arriendos: [], error: error instanceof Error ? error.message : 'Error desconocido al consultar Arriendos.' }, { status: 502 });
  }
}

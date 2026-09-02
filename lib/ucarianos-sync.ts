import { hasGoogleSheetsConfig, fetchSheetOrExcelValues, rowsToObjects } from './google-sheets';
import { NOTION_VERSION, resolveDataSourceId } from './notion-data-source';

const NOTION_API_BASE = 'https://api.notion.com/v1';

type NotionSchemaProperty = { type?: string };

type NotionPropertyValue = Record<string, unknown> & {
  type?: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  email?: string | null;
  phone_number?: string | null;
  url?: string | null;
  select?: { name?: string } | null;
};

type NotionRow = { id: string; properties: Record<string, NotionPropertyValue> };

export type UcarianosSyncResult = {
  ranSync: boolean;
  created: number;
  updated: number;
  archived: number;
  errors: string[];
};

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// El RUT chileno puede traer puntos/guion; se compara solo por digitos + digito verificador.
function normalizeRut(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^0-9K]/g, '');
}

const NAME_FIELD_KEYS = ['nombrecompleto', 'nombre', 'name'];
const EMAIL_FIELD_KEYS = ['correoelectronico', 'correo', 'email', 'mail'];
const RUT_FIELD_KEYS = ['rut', 'run'];

function pickField(row: Record<string, string>, candidateKeys: string[]) {
  for (const [header, value] of Object.entries(row)) {
    if (candidateKeys.includes(normalizeKey(header))) {
      return (value || '').trim();
    }
  }
  return '';
}

async function notionFetch(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    cache: 'no-store'
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((payload as { message?: string }).message || `Error de Notion (${response.status}).`);
  }

  return payload;
}

async function getSchema(dataSourceId: string, token: string) {
  const schema = (await notionFetch(`/data_sources/${dataSourceId}`, token)) as {
    properties?: Record<string, NotionSchemaProperty>;
  };
  return schema.properties || {};
}

function findPropertyName(properties: Record<string, NotionSchemaProperty>, candidates: string[]) {
  return candidates.find((candidate) => Boolean(properties[candidate]));
}

function getTitlePropertyName(properties: Record<string, NotionSchemaProperty>) {
  return Object.keys(properties).find((key) => properties[key]?.type === 'title');
}

function buildPropertyValue(type: string | undefined, value: string) {
  switch (type) {
    case 'title':
      return { title: value ? [{ text: { content: value } }] : [] };
    case 'email':
      return { email: value || null };
    case 'phone_number':
      return { phone_number: value || null };
    case 'url':
      return { url: value || null };
    case 'select':
      return value ? { select: { name: value } } : { select: null };
    case 'rich_text':
    default:
      return { rich_text: value ? [{ text: { content: value } }] : [] };
  }
}

function getPropertyText(property?: NotionPropertyValue) {
  if (!property) return '';
  if (Array.isArray(property.title)) return property.title.map((item) => item.plain_text || '').join('').trim();
  if (Array.isArray(property.rich_text)) return property.rich_text.map((item) => item.plain_text || '').join('').trim();
  if (typeof property.email === 'string') return property.email;
  if (typeof property.phone_number === 'string') return property.phone_number;
  if (typeof property.url === 'string') return property.url;
  if (property.select?.name) return property.select.name;
  return '';
}

async function queryAllRows(dataSourceId: string, token: string) {
  const rows: NotionRow[] = [];
  let cursor: string | undefined;

  do {
    const payload = (await notionFetch(`/data_sources/${dataSourceId}/query`, token, {
      method: 'POST',
      body: JSON.stringify({ start_cursor: cursor, page_size: 100 })
    })) as { results?: NotionRow[]; has_more?: boolean; next_cursor?: string | null };

    rows.push(...(payload.results || []));
    cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
  } while (cursor);

  return rows;
}

export function hasUcarianosSheetSyncConfig() {
  return Boolean(
    hasGoogleSheetsConfig() &&
      process.env.GOOGLE_SHEET_UCARIANOS_DB_ID &&
      process.env.NOTION_API_KEY &&
      process.env.NOTION_USERS_DATABASE_ID
  );
}

/**
 * Sincroniza la hoja de Google Sheets (fuente principal de Ucarianos) hacia Notion: crea o
 * actualiza paginas por RUT y archiva en Notion los Ucarianos que ya no estan en la hoja.
 */
export async function syncUcarianosSheetToNotion(): Promise<UcarianosSyncResult> {
  const result: UcarianosSyncResult = { ranSync: false, created: 0, updated: 0, archived: 0, errors: [] };

  if (!hasUcarianosSheetSyncConfig()) {
    return result;
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_UCARIANOS_DB_ID as string;
  const range = process.env.GOOGLE_SHEET_UCARIANOS_DB_RANGE || 'Final Leads';
  const databaseId = process.env.NOTION_USERS_DATABASE_ID as string;
  const notionToken = process.env.NOTION_API_KEY as string;

  result.ranSync = true;

  try {
    const rawRows = await fetchSheetOrExcelValues(spreadsheetId, range);
    const sheetRows = rowsToObjects(rawRows);

    const dataSourceId = await resolveDataSourceId(databaseId, notionToken);
    const schema = await getSchema(dataSourceId, notionToken);
    const titlePropName = getTitlePropertyName(schema);
    const namePropName = findPropertyName(schema, ['Nombre', 'Name']);
    const emailPropName = findPropertyName(schema, ['Email', 'Correo', 'Mail']);
    const rutPropName = findPropertyName(schema, ['RUT', 'Rut', 'RUN', 'Run', 'Documento']);

    if (!rutPropName) {
      result.errors.push('La base de Ucarianos en Notion no tiene una propiedad de RUT/RUN reconocible.');
      return result;
    }

    const existingRows = await queryAllRows(dataSourceId, notionToken);
    const existingByRut = new Map<string, NotionRow>();

    for (const row of existingRows) {
      const rutValue = normalizeRut(getPropertyText(row.properties[rutPropName]));
      if (rutValue) {
        existingByRut.set(rutValue, row);
      }
    }

    const activeRuts = new Set<string>();

    for (const sheetRow of sheetRows) {
      const rutRaw = pickField(sheetRow, RUT_FIELD_KEYS);
      const rut = normalizeRut(rutRaw);

      if (!rut) {
        continue;
      }

      activeRuts.add(rut);

      const nombre = pickField(sheetRow, NAME_FIELD_KEYS);
      const email = pickField(sheetRow, EMAIL_FIELD_KEYS);

      const properties: Record<string, unknown> = {
        [rutPropName]: buildPropertyValue(schema[rutPropName]?.type, rutRaw)
      };

      if (titlePropName) {
        properties[titlePropName] = buildPropertyValue('title', nombre);
      }

      if (namePropName && namePropName !== titlePropName) {
        properties[namePropName] = buildPropertyValue(schema[namePropName]?.type, nombre);
      }

      if (emailPropName) {
        properties[emailPropName] = buildPropertyValue(schema[emailPropName]?.type, email);
      }

      const existing = existingByRut.get(rut);

      try {
        if (existing) {
          await notionFetch(`/pages/${existing.id}`, notionToken, {
            method: 'PATCH',
            body: JSON.stringify({ properties })
          });
          result.updated += 1;
        } else {
          await notionFetch('/pages', notionToken, {
            method: 'POST',
            body: JSON.stringify({ parent: { data_source_id: dataSourceId }, properties })
          });
          result.created += 1;
        }
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : `No se pudo sincronizar el RUT ${rutRaw}.`);
      }
    }

    for (const [rut, row] of existingByRut.entries()) {
      if (!activeRuts.has(rut)) {
        try {
          await notionFetch(`/pages/${row.id}`, notionToken, {
            method: 'PATCH',
            body: JSON.stringify({ archived: true })
          });
          result.archived += 1;
        } catch (error) {
          result.errors.push(error instanceof Error ? error.message : `No se pudo archivar el RUT ${rut}.`);
        }
      }
    }
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : 'Error desconocido al sincronizar Ucarianos desde el Sheet.'
    );
  }

  return result;
}

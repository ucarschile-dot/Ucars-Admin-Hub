import { Client } from '@notionhq/client';
import { NOTION_VERSION, resolveDataSourceId, notionApiFetch } from './notion-data-source';

type NotionProperty = Record<string, unknown> & {
  type?: string;
  rich_text?: Array<{ plain_text?: string }>;
  title?: Array<{ plain_text?: string }>;
  select?: { name?: string };
  multi_select?: Array<{ name?: string }>;
  status?: { name?: string };
  number?: number | null;
  email?: string | null;
  phone_number?: string | null;
  url?: string | null;
  date?: { start?: string | null } | null;
};

type NotionRow = {
  id: string;
  properties: Record<string, NotionProperty>;
};

export type AdminLoginProfile = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

const notion = process.env.NOTION_API_KEY ? new Client({ auth: process.env.NOTION_API_KEY }) : null;

const databaseIds = {
  users: process.env.NOTION_USERS_DATABASE_ID
};

function getText(property?: NotionProperty | null) {
  if (!property) {
    return '';
  }

  if (Array.isArray(property.title) && property.title.length > 0) {
    return property.title.map((item) => item.plain_text || '').join('').trim();
  }

  if (Array.isArray(property.rich_text) && property.rich_text.length > 0) {
    return property.rich_text.map((item) => item.plain_text || '').join('').trim();
  }

  if (typeof property.email === 'string') {
    return property.email;
  }

  if (typeof property.phone_number === 'string') {
    return property.phone_number;
  }

  if (typeof property.url === 'string') {
    return property.url;
  }

  if (property.select?.name) {
    return property.select.name;
  }

  if (Array.isArray(property.multi_select) && property.multi_select.length > 0) {
    return property.multi_select.map((item) => item.name || '').filter(Boolean).join(', ');
  }

  if (property.status?.name) {
    return property.status.name;
  }

  if (property.date?.start) {
    return property.date.start;
  }

  if (typeof property.number === 'number') {
    return String(property.number);
  }

  return '';
}

function pickProperty(properties: Record<string, NotionProperty>, candidates: string[]) {
  return candidates.map((candidate) => properties[candidate]).find(Boolean);
}

function getRoleNames(property?: NotionProperty | null) {
  if (!property) {
    return [] as string[];
  }

  if (Array.isArray(property.multi_select) && property.multi_select.length > 0) {
    return property.multi_select.map((item) => (item.name || '').trim()).filter(Boolean);
  }

  if (property.select?.name) {
    return [property.select.name.trim()].filter(Boolean);
  }

  return getText(property)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasAdministratorRole(roles: string[]) {
  return roles.some((role) => role.localeCompare('Administrador', 'es', { sensitivity: 'accent' }) === 0);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePin(pin: string) {
  return pin.trim();
}

async function queryDatabase(databaseId?: string) {
  if (!notion || !databaseId) {
    return [] as NotionRow[];
  }

  const notionToken = process.env.NOTION_API_KEY as string;
  const dataSourceId = await resolveDataSourceId(databaseId, notionToken);

  const rows: NotionRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionApiFetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start_cursor: cursor,
        page_size: 100
      })
    });

    const payload = (await response.json()) as {
      results?: NotionRow[];
      has_more?: boolean;
      next_cursor?: string | null;
      message?: string;
    };

    if (!response.ok || !Array.isArray(payload.results)) {
      throw new Error(payload.message || `No se pudo consultar la base ${databaseId} en Notion.`);
    }

    rows.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
  } while (cursor);

  return rows;
}

export function hasAdminAuthConfig() {
  return Boolean(notion && databaseIds.users);
}

export async function authenticateAdminByCredentials(
  email: string,
  pin: string
): Promise<AdminLoginProfile | null> {
  if (!hasAdminAuthConfig()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPin = normalizePin(pin);

  if (!normalizedEmail || !normalizedPin) {
    return null;
  }

  const userRows = await queryDatabase(databaseIds.users);

  for (const row of userRows) {
    const properties = row.properties;
    const userEmail = normalizeEmail(getText(pickProperty(properties, ['Email', 'Correo', 'Mail'])));
    const userPin = normalizePin(getText(pickProperty(properties, ['PIN', 'Pin'])));
    const roles = getRoleNames(pickProperty(properties, ['Rol', 'Roles', 'Role', 'Cargo']));

    if (userEmail !== normalizedEmail || userPin !== normalizedPin) {
      continue;
    }

    if (!hasAdministratorRole(roles)) {
      return null;
    }

    return {
      id: row.id,
      name: getText(pickProperty(properties, ['Nombre', 'Name'])) || 'Administrador',
      email: userEmail,
      roles
    };
  }

  return null;
}
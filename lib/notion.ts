import { Client } from '@notionhq/client';
import { mockDataset } from '@/lib/mock-data';
import type { AdminDataset, AgendaItem, NotificationItem, StockStatus, StockVehicle, Ucariano } from '@/lib/types';

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
  stock: process.env.NOTION_STOCK_DATABASE_ID,
  users: process.env.NOTION_USERS_DATABASE_ID,
  agenda: process.env.NOTION_AGENDA_DATABASE_ID,
  notifications: process.env.NOTION_NOTIFICATIONS_DATABASE_ID
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

function getNumber(property?: NotionProperty | null) {
  if (typeof property?.number === 'number') {
    return property.number;
  }

  const parsed = Number(getText(property));
  return Number.isFinite(parsed) ? parsed : 0;
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

  const rows: NotionRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
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

function normalizeStockStatus(value: string): StockStatus {
  if (/reserv/i.test(value)) {
    return 'Reservado';
  }

  if (/prep/i.test(value)) {
    return 'Preparacion';
  }

  if (/entreg/i.test(value) || /vendid/i.test(value)) {
    return 'Entregado';
  }

  return 'Disponible';
}

function toStockVehicle(row: NotionRow): StockVehicle {
  const properties = row.properties;
  const brand = getText(pickProperty(properties, ['Marca', 'Brand']));
  const model = getText(pickProperty(properties, ['Vehículo', 'Vehiculo', 'Modelo', 'Vehicle']));
  const version = getText(pickProperty(properties, ['Versión', 'Version']));
  const year = getNumber(pickProperty(properties, ['Año', 'Ano', 'Year']));
  const price = getNumber(pickProperty(properties, ['Precio Actual', 'Precio', 'Price']));
  const mileage = getNumber(pickProperty(properties, ['Kilometraje', 'Km', 'Mileage']));
  const status = normalizeStockStatus(getText(pickProperty(properties, ['Estado', 'Status'])));
  const assignedAdvisor = getText(pickProperty(properties, ['Ucariano Asignado', 'Advisor', 'Ejecutivo']));
  const branch = getText(pickProperty(properties, ['Sucursal', 'Branch']));
  const leadSource = getText(pickProperty(properties, ['Origen Lead', 'Lead Source', 'Origen'])) || 'No definido';
  const publishedAt = getText(pickProperty(properties, ['Publicado', 'Published At', 'Fecha publicación'])) || new Date().toISOString();

  return {
    id: row.id,
    brand: brand || 'Sin marca',
    model: model || 'Sin modelo',
    version: version || 'Sin versión',
    year: year || new Date().getFullYear(),
    price,
    mileage,
    status,
    assignedAdvisor: assignedAdvisor || 'Sin asignar',
    branch: branch || 'Sin sucursal',
    leadSource,
    publishedAt
  };
}

function toUcariano(row: NotionRow): Ucariano {
  const properties = row.properties;
  return {
    id: row.id,
    name: getText(pickProperty(properties, ['Nombre', 'Name'])) || 'Sin nombre',
    email: getText(pickProperty(properties, ['Email', 'Correo'])) || 'sin-correo@ucars.cl',
    phone: getText(pickProperty(properties, ['Teléfono', 'Telefono', 'Phone'])) || 'Sin teléfono',
    status: (getText(pickProperty(properties, ['Estado', 'Status'])) as Ucariano['status']) || 'Activo',
    branch: getText(pickProperty(properties, ['Sucursal', 'Branch'])) || 'Sin sucursal',
    activeDeals: getNumber(pickProperty(properties, ['Negocios Activos', 'Active Deals'])),
    monthlyGoal: getNumber(pickProperty(properties, ['Meta Mensual', 'Monthly Goal'])),
    closeRate: getNumber(pickProperty(properties, ['Close Rate', 'Tasa Cierre']))
  };
}

function toAgendaItem(row: NotionRow): AgendaItem {
  const properties = row.properties;
  return {
    id: row.id,
    customerName: getText(pickProperty(properties, ['Cliente', 'Customer'])) || 'Cliente sin nombre',
    vehicleLabel: getText(pickProperty(properties, ['Vehículo', 'Vehiculo', 'Vehicle'])) || 'Vehículo no informado',
    advisorName: getText(pickProperty(properties, ['Ucariano', 'Advisor', 'Ejecutivo'])) || 'Sin asesor',
    date: getText(pickProperty(properties, ['Fecha', 'Date'])) || new Date().toISOString(),
    location: getText(pickProperty(properties, ['Lugar', 'Location'])) || 'Por definir',
    status: (getText(pickProperty(properties, ['Estado', 'Status'])) as AgendaItem['status']) || 'Pendiente',
    channel: (getText(pickProperty(properties, ['Canal', 'Channel'])) as AgendaItem['channel']) || 'Sucursal'
  };
}

function toNotification(row: NotionRow): NotificationItem {
  const properties = row.properties;
  return {
    id: row.id,
    title: getText(pickProperty(properties, ['Título', 'Titulo', 'Title'])) || 'Sin título',
    message: getText(pickProperty(properties, ['Mensaje', 'Message'])) || 'Sin contenido',
    audience: getText(pickProperty(properties, ['Audiencia', 'Audience'])) || 'General',
    priority: (getText(pickProperty(properties, ['Prioridad', 'Priority'])) as NotificationItem['priority']) || 'Media',
    sentAt: getText(pickProperty(properties, ['Envío', 'Envio', 'Sent At'])) || new Date().toISOString(),
    channel: (getText(pickProperty(properties, ['Canal', 'Channel'])) as NotificationItem['channel']) || 'Interna',
    state: (getText(pickProperty(properties, ['Estado', 'Status'])) as NotificationItem['state']) || 'Borrador'
  };
}

function hasNotionConfig() {
  return Boolean(
    notion &&
      databaseIds.stock &&
      databaseIds.users &&
      databaseIds.agenda &&
      databaseIds.notifications
  );
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

export async function getAdminDataset(): Promise<AdminDataset> {
  if (!hasNotionConfig()) {
    return mockDataset;
  }

  try {
    const [stockRows, userRows, agendaRows, notificationRows] = await Promise.all([
      queryDatabase(databaseIds.stock),
      queryDatabase(databaseIds.users),
      queryDatabase(databaseIds.agenda),
      queryDatabase(databaseIds.notifications)
    ]);

    return {
      source: 'notion',
      stock: stockRows.map(toStockVehicle),
      ucarianos: userRows.map(toUcariano),
      agenda: agendaRows.map(toAgendaItem),
      notifications: notificationRows.map(toNotification)
    };
  } catch (error) {
    console.error('Falling back to mock dataset because Notion query failed.', error);
    return mockDataset;
  }
}
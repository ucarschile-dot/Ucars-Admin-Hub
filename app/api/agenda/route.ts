import { mockDataset } from '@/lib/mock-data';

type NotionProperty = Record<string, unknown> & {
  type?: string;
  rich_text?: Array<{ plain_text?: string }>;
  title?: Array<{ plain_text?: string }>;
  select?: { name?: string };
  status?: { name?: string };
  date?: { start?: string | null } | null;
  relation?: Array<{ id?: string }>;
  place?: { name?: string; address?: string; lat?: number; lon?: number } | null;
  url?: string | null;
};

type NotionRow = {
  id: string;
  properties: Record<string, NotionProperty>;
};

type AgendaItem = {
  id: string;
  customerName: string;
  vehicleLabel: string;
  vehicleId: string | null;
  advisorName: string;
  advisorId: string | null;
  date: string;
  dateRaw: string;
  timeRaw: string;
  location: string;
  status: string;
  channel: string;
};

const VEHICLE_RELATION_CANDIDATES = ['Auto de interés', 'Auto de interes', 'Vehículo', 'Vehiculo', 'Vehicle', 'Auto'];
const ASSIGNED_UCARIANO_CANDIDATES = [
  'Ucariano Asignado',
  'Ucariano',
  'Advisor',
  'Ejecutivo',
  'Asignado',
  'Asignado a',
  'Assigned Ucariano',
  'Assigned Advisor'
];
const CLIENT_CANDIDATES = ['Cliente', 'Customer', 'Nombre cliente'];
const DATE_CANDIDATES = ['Fecha', 'Date', 'Fecha visita', 'Fecha test drive'];
const TIME_CANDIDATES = ['Hora', 'Time'];
const LOCATION_CANDIDATES = ['Lugar', 'Location', 'Sucursal'];
const STATUS_CANDIDATES = ['Estado', 'Status'];
const CHANNEL_CANDIDATES = ['Canal', 'Channel'];

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

  if (property.select?.name) {
    return property.select.name;
  }

  if (property.status?.name) {
    return property.status.name;
  }

  if (property.place) {
    return property.place.name?.split(',')[0] || property.place.address?.split(',')[0] || '';
  }

  if (typeof property.url === 'string') {
    return property.url;
  }

  if (property.date?.start) {
    return property.date.start || '';
  }

  return '';
}

function pickProperty(properties: Record<string, NotionProperty>, candidates: string[]) {
  return candidates.map((candidate) => properties[candidate]).find(Boolean);
}

function getPropertyNameByType(properties: Record<string, NotionProperty>, type: string) {
  return Object.keys(properties).find((key) => properties[key]?.type === type);
}

function buildUserNameMap(rows: NotionRow[]) {
  const map = new Map<string, string>();

  rows.forEach((row) => {
    const name =
      getText(pickProperty(row.properties, ['Nombre', 'Name', 'Ucariano'])) ||
      getText(row.properties[getPropertyNameByType(row.properties, 'title') || '']) ||
      'Sin nombre';

    map.set(row.id, name);
  });

  return map;
}

function buildVehicleNameMap(rows: NotionRow[]) {
  const map = new Map<string, string>();

  rows.forEach((row) => {
    const brand = getText(pickProperty(row.properties, ['Marca', 'Brand']));
    const model = getText(pickProperty(row.properties, ['Vehículo', 'Vehiculo', 'Modelo', 'Model', 'Vehicle', 'Nombre', 'Name']));
    const version = getText(pickProperty(row.properties, ['Versión', 'Version', 'Trim']));
    const name = [brand, model, version].filter(Boolean).join(' ').trim();

    map.set(row.id, name || 'Vehiculo sin nombre');
  });

  return map;
}

type VehicleAdvisorInfo = { id: string | null; name: string };

function buildVehicleAdvisorMap(rows: NotionRow[], userNameMap: Map<string, string>) {
  const map = new Map<string, VehicleAdvisorInfo>();

  rows.forEach((row) => {
    const explicit = pickProperty(row.properties, ASSIGNED_UCARIANO_CANDIDATES);
    let advisorId: string | null = null;
    let advisorName = '';

    if (explicit && Array.isArray(explicit.relation) && explicit.relation.length > 0) {
      advisorId = explicit.relation[0]?.id || null;
      advisorName = advisorId ? userNameMap.get(advisorId) || '' : '';
    }

    if (!advisorName) {
      advisorName = getText(explicit);
    }

    map.set(row.id, { id: advisorId, name: advisorName || 'Sin asignar' });
  });

  return map;
}

function combineDateAndTime(dateRaw: string, timeRaw: string) {
  if (!dateRaw) {
    return new Date().toISOString();
  }

  if (dateRaw.includes('T')) {
    return dateRaw;
  }

  const timeMatch = timeRaw.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = timeMatch[1].padStart(2, '0');
    const minutes = timeMatch[2];
    return `${dateRaw}T${hours}:${minutes}:00`;
  }

  return dateRaw;
}

function toAgendaItem(
  row: NotionRow,
  vehicleAdvisorMap: Map<string, VehicleAdvisorInfo>,
  vehicleNameMap: Map<string, string>
): AgendaItem {
  const properties = row.properties;

  const customerName = getText(pickProperty(properties, CLIENT_CANDIDATES)) || 'Cliente sin nombre';
  const vehicleProperty = pickProperty(properties, VEHICLE_RELATION_CANDIDATES);
  const vehicleId = Array.isArray(vehicleProperty?.relation) && vehicleProperty.relation.length > 0
    ? vehicleProperty.relation[0]?.id || null
    : null;
  const vehicleLabel =
    getText(vehicleProperty) ||
    (vehicleId ? vehicleNameMap.get(vehicleId) : undefined) ||
    'Vehiculo no informado';

  const directAdvisor = pickProperty(properties, ASSIGNED_UCARIANO_CANDIDATES);
  const directAdvisorName = getText(directAdvisor);
  const linkedAdvisor = vehicleId ? vehicleAdvisorMap.get(vehicleId) : undefined;

  const advisorName = directAdvisorName || linkedAdvisor?.name || 'Sin asesor';
  const advisorId = linkedAdvisor?.id ?? null;

  const dateRaw = getText(pickProperty(properties, DATE_CANDIDATES));
  const timeRaw = getText(pickProperty(properties, TIME_CANDIDATES));
  const location = getText(pickProperty(properties, LOCATION_CANDIDATES)) || 'Por definir';
  const status = getText(pickProperty(properties, STATUS_CANDIDATES)) || 'Pendiente';
  const channel = getText(pickProperty(properties, CHANNEL_CANDIDATES)) || 'Sucursal';

  return {
    id: row.id,
    customerName,
    vehicleLabel,
    vehicleId,
    advisorName,
    advisorId,
    date: combineDateAndTime(dateRaw, timeRaw),
    dateRaw,
    timeRaw,
    location,
    status,
    channel
  };
}

async function queryDatabaseRows(databaseId: string) {
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
      }),
      cache: 'no-store'
    });

    const payload = (await response.json()) as {
      results?: NotionRow[];
      has_more?: boolean;
      next_cursor?: string | null;
      message?: string;
    };

    if (!response.ok || !Array.isArray(payload.results)) {
      throw new Error(payload.message || 'No se pudo consultar la base en Notion.');
    }

    rows.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
  } while (cursor);

  return rows;
}

function fallbackAgenda(): AgendaItem[] {
  return mockDataset.agenda.map((item) => ({
    id: item.id,
    customerName: item.customerName,
    vehicleLabel: item.vehicleLabel,
    vehicleId: null,
    advisorName: item.advisorName,
    advisorId: null,
    date: item.date,
    dateRaw: item.date.slice(0, 10),
    timeRaw: '',
    location: item.location,
    status: item.status,
    channel: item.channel
  }));
}

function sortByDate(items: AgendaItem[]) {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    return timeA - timeB;
  });
}

export async function GET() {
  const agendaDb = process.env.NOTION_AGENDA_DATABASE_ID;
  const stockDb = process.env.NOTION_STOCK_DATABASE_ID;
  const usersDb = process.env.NOTION_USERS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!agendaDb || !notionToken) {
    return Response.json(
      { source: 'mock', agenda: sortByDate(fallbackAgenda()) },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  try {
    const [agendaRows, stockRows, userRows] = await Promise.all([
      queryDatabaseRows(agendaDb),
      stockDb ? queryDatabaseRows(stockDb) : Promise.resolve([] as NotionRow[]),
      usersDb ? queryDatabaseRows(usersDb) : Promise.resolve([] as NotionRow[])
    ]);

    const userNameMap = buildUserNameMap(userRows);
    const vehicleAdvisorMap = buildVehicleAdvisorMap(stockRows, userNameMap);
    const vehicleNameMap = buildVehicleNameMap(stockRows);
    const agenda = sortByDate(agendaRows.map((row) => toAgendaItem(row, vehicleAdvisorMap, vehicleNameMap)));

    return Response.json(
      { source: 'notion', agenda },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('Error al consultar Agenda en Notion. Se usa fallback mock.', error);

    return Response.json(
      { source: 'mock', agenda: sortByDate(fallbackAgenda()) },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}

type AgendaSchemaProperty = { type?: string; select?: { options?: Array<{ name?: string }> } };

async function getNotionDatabaseSchema(databaseId: string, notionToken: string) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28'
    },
    cache: 'no-store'
  });

  const schema = (await response.json()) as {
    properties?: Record<string, AgendaSchemaProperty>;
    message?: string;
  };

  if (!response.ok || !schema.properties) {
    throw new Error(schema.message || 'No se pudo leer el esquema de la base en Notion.');
  }

  return schema.properties;
}

function findPropertyName(properties: Record<string, AgendaSchemaProperty>, candidates: string[]) {
  return candidates.find((candidate) => Boolean(properties[candidate]));
}

function getTitlePropertyName(properties: Record<string, AgendaSchemaProperty>) {
  return Object.keys(properties).find((key) => properties[key]?.type === 'title');
}

const NOTIFICATION_MESSAGE_CANDIDATES = ['Mensaje', 'Message', 'Descripcion', 'Descripción'];
const NOTIFICATION_DATE_CANDIDATES = ['Fecha', 'Date'];
const NOTIFICATION_PERSONA_CANDIDATES = ['Persona', 'Ucariano', 'Asesor'];
const NOTIFICATION_VEHICLE_CANDIDATES = ['Vehículo', 'Vehiculo', 'Auto', 'Auto de interés'];

async function getVehicleInfo(vehicleId: string, notionToken: string) {
  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${vehicleId}`, {
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28'
      },
      cache: 'no-store'
    });

    const page = (await response.json()) as { properties?: Record<string, NotionProperty> };

    if (!response.ok || !page.properties) {
      return { advisorId: null as string | null, name: '' };
    }

    const explicit = pickProperty(page.properties, ASSIGNED_UCARIANO_CANDIDATES);
    const advisorId =
      explicit && Array.isArray(explicit.relation) && explicit.relation.length > 0
        ? explicit.relation[0]?.id || null
        : null;

    const brand = getText(pickProperty(page.properties, ['Marca', 'Brand']));
    const model = getText(pickProperty(page.properties, ['Vehículo', 'Vehiculo', 'Modelo', 'Model', 'Vehicle', 'Nombre', 'Name']));
    const version = getText(pickProperty(page.properties, ['Versión', 'Version', 'Trim']));
    const name = [brand, model, version].filter(Boolean).join(' ').trim() || 'el vehiculo';

    return { advisorId, name };
  } catch (error) {
    console.error('No se pudo leer el vehiculo para notificar al ucariano.', error);
    return { advisorId: null as string | null, name: '' };
  }
}

async function notifyUcariano(options: {
  notionToken: string;
  notificationsDb?: string;
  title: string;
  message: string;
  date?: string;
  personaId: string | null;
  vehicleId?: string | null;
}) {
  const { notionToken, notificationsDb, title, message, date, personaId, vehicleId } = options;

  if (!notificationsDb || !personaId) {
    return;
  }

  try {
    const schemaProperties = await getNotionDatabaseSchema(notificationsDb, notionToken);
    const properties: Record<string, unknown> = {};

    const titlePropName = getTitlePropertyName(schemaProperties);
    if (titlePropName) {
      properties[titlePropName] = { title: [{ text: { content: title } }] };
    }

    const messagePropName = findPropertyName(schemaProperties, NOTIFICATION_MESSAGE_CANDIDATES);
    if (messagePropName) {
      properties[messagePropName] = { rich_text: [{ text: { content: message } }] };
    }

    const datePropName = findPropertyName(schemaProperties, NOTIFICATION_DATE_CANDIDATES);
    if (datePropName && date) {
      properties[datePropName] = { date: { start: date } };
    }

    const personaPropName = findPropertyName(schemaProperties, NOTIFICATION_PERSONA_CANDIDATES);
    if (personaPropName) {
      properties[personaPropName] = { relation: [{ id: personaId }] };
    }

    const vehiclePropName = findPropertyName(schemaProperties, NOTIFICATION_VEHICLE_CANDIDATES);
    if (vehiclePropName && vehicleId) {
      properties[vehiclePropName] = { relation: [{ id: vehicleId }] };
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: notificationsDb },
        properties
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      throw new Error(payload.message || 'No se pudo crear la notificacion en Notion.');
    }
  } catch (error) {
    console.error('No se pudo notificar al ucariano sobre el cambio en su agenda.', error);
  }
}

export async function PATCH(request: Request) {
  const agendaDb = process.env.NOTION_AGENDA_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!agendaDb || !notionToken) {
    return Response.json({ error: 'Notion no esta configurado en esta app.' }, { status: 503 });
  }

  let body: {
    id?: string;
    customerName?: string;
    date?: string;
    time?: string;
    location?: string;
    status?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud invalido.' }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return Response.json({ error: 'Falta el identificador de la cita.' }, { status: 400 });
  }

  try {
    const schemaProperties = await getNotionDatabaseSchema(agendaDb, notionToken);
    const properties: Record<string, unknown> = {};
    const skipped: string[] = [];

    const clientPropName = findPropertyName(schemaProperties, CLIENT_CANDIDATES);
    if (clientPropName && typeof body.customerName === 'string') {
      properties[clientPropName] = { rich_text: body.customerName ? [{ text: { content: body.customerName } }] : [] };
    }

    const datePropName = findPropertyName(schemaProperties, DATE_CANDIDATES);
    if (datePropName && typeof body.date === 'string') {
      properties[datePropName] = { date: body.date ? { start: body.date } : null };
    }

    const timePropName = findPropertyName(schemaProperties, TIME_CANDIDATES);
    if (timePropName && typeof body.time === 'string') {
      properties[timePropName] = { rich_text: body.time ? [{ text: { content: body.time } }] : [] };
    }

    const locationPropName = findPropertyName(schemaProperties, LOCATION_CANDIDATES);
    if (locationPropName && typeof body.location === 'string') {
      const locationType = schemaProperties[locationPropName]?.type;
      if (locationType === 'rich_text') {
        properties[locationPropName] = { rich_text: body.location ? [{ text: { content: body.location } }] : [] };
      } else if (locationType === 'url') {
        properties[locationPropName] = { url: body.location || null };
      } else {
        skipped.push(locationPropName);
      }
    }

    const statusPropName = findPropertyName(schemaProperties, STATUS_CANDIDATES);
    if (statusPropName && typeof body.status === 'string' && body.status) {
      const statusType = schemaProperties[statusPropName]?.type;
      if (statusType === 'status') {
        properties[statusPropName] = { status: { name: body.status } };
      } else if (statusType === 'select') {
        properties[statusPropName] = { select: { name: body.status } };
      } else {
        skipped.push(statusPropName);
      }
    }

    if (Object.keys(properties).length === 0) {
      return Response.json({ error: 'No hay campos validos para actualizar.' }, { status: 422 });
    }

    const currentPageResponse = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28'
      },
      cache: 'no-store'
    });
    const currentPage = (await currentPageResponse.json()) as { properties?: Record<string, NotionProperty> };
    const currentVehicleProperty = currentPage.properties
      ? pickProperty(currentPage.properties, VEHICLE_RELATION_CANDIDATES)
      : undefined;
    const vehicleId =
      currentVehicleProperty && Array.isArray(currentVehicleProperty.relation) && currentVehicleProperty.relation.length > 0
        ? currentVehicleProperty.relation[0]?.id || null
        : null;

    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    const updatePayload = (await updateResponse.json()) as { message?: string };

    if (!updateResponse.ok) {
      throw new Error(updatePayload.message || 'No se pudo actualizar la cita en Notion.');
    }

    if (vehicleId) {
      const { advisorId, name: vehicleName } = await getVehicleInfo(vehicleId, notionToken);
      const dateLabel = body.date ? `${body.date}${body.time ? ' a las ' + body.time : ''}` : '';
      const messageParts = [
        `Tu cita para ${vehicleName || 'el vehiculo'} fue modificada.`,
        dateLabel ? `Nueva fecha: ${dateLabel}.` : '',
        body.location ? `Lugar: ${body.location}.` : '',
        body.status ? `Estado: ${body.status}.` : ''
      ].filter(Boolean);

      await notifyUcariano({
        notionToken,
        notificationsDb: process.env.NOTION_NOTIFICATIONS_DATABASE_ID,
        title: `Cambio en tu agenda: ${vehicleName || 'vehiculo'}`,
        message: messageParts.join(' '),
        date: body.date,
        personaId: advisorId,
        vehicleId
      });
    }

    return Response.json(
      { id, skipped },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al actualizar la agenda en Notion.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al actualizar la cita.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const agendaDb = process.env.NOTION_AGENDA_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!agendaDb || !notionToken) {
    return Response.json({ error: 'Notion no esta configurado en esta app.' }, { status: 503 });
  }

  let body: {
    customerName?: string;
    vehicleId?: string;
    vehicleName?: string;
    date?: string;
    time?: string;
    location?: string;
    status?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud invalido.' }, { status: 400 });
  }

  const customerName = body.customerName?.trim();
  const vehicleId = body.vehicleId?.trim();
  const vehicleName = body.vehicleName?.trim() || 'el vehiculo';
  const date = body.date?.trim();

  if (!customerName || !vehicleId || !date) {
    return Response.json({ error: 'Faltan datos obligatorios: cliente, vehiculo y fecha.' }, { status: 400 });
  }

  try {
    const schemaProperties = await getNotionDatabaseSchema(agendaDb, notionToken);
    const properties: Record<string, unknown> = {};
    const skipped: string[] = [];

    const titlePropName = getTitlePropertyName(schemaProperties);
    if (titlePropName) {
      const tituloCita = `Con ${customerName} para ver ${vehicleName}`;
      properties[titlePropName] = { title: [{ text: { content: tituloCita } }] };
    }

    const clientPropName = findPropertyName(schemaProperties, CLIENT_CANDIDATES);
    if (clientPropName) {
      properties[clientPropName] = { rich_text: [{ text: { content: customerName } }] };
    }

    const datePropName = findPropertyName(schemaProperties, DATE_CANDIDATES);
    if (datePropName) {
      properties[datePropName] = { date: { start: date } };
    }

    const timePropName = findPropertyName(schemaProperties, TIME_CANDIDATES);
    if (timePropName && body.time) {
      properties[timePropName] = { rich_text: [{ text: { content: body.time } }] };
    }

    const locationPropName = findPropertyName(schemaProperties, LOCATION_CANDIDATES);
    if (locationPropName && body.location) {
      const locationType = schemaProperties[locationPropName]?.type;
      if (locationType === 'rich_text') {
        properties[locationPropName] = { rich_text: [{ text: { content: body.location } }] };
      } else if (locationType === 'url') {
        properties[locationPropName] = { url: body.location };
      } else {
        skipped.push(locationPropName);
      }
    }

    const vehiclePropName = findPropertyName(schemaProperties, VEHICLE_RELATION_CANDIDATES);
    if (!vehiclePropName) {
      return Response.json(
        { error: 'No se encontro la propiedad de relacion con el vehiculo en la base de Agenda.' },
        { status: 422 }
      );
    }
    properties[vehiclePropName] = { relation: [{ id: vehicleId }] };

    const statusPropName = findPropertyName(schemaProperties, STATUS_CANDIDATES);
    const statusValue = body.status?.trim() || 'Por confirmar';
    if (statusPropName) {
      const statusType = schemaProperties[statusPropName]?.type;
      if (statusType === 'status') {
        properties[statusPropName] = { status: { name: statusValue } };
      } else if (statusType === 'select') {
        properties[statusPropName] = { select: { name: statusValue } };
      } else {
        skipped.push(statusPropName);
      }
    }

    const createResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: agendaDb },
        properties
      })
    });

    const createPayload = (await createResponse.json()) as { id?: string; message?: string };

    if (!createResponse.ok || !createPayload.id) {
      throw new Error(createPayload.message || 'No se pudo crear la cita en Notion.');
    }

    const { advisorId, name: resolvedVehicleName } = await getVehicleInfo(vehicleId, notionToken);
    const dateLabel = `${date}${body.time ? ' a las ' + body.time : ''}`;
    const messageParts = [
      `Se agendo un test drive con ${customerName} para ${resolvedVehicleName || vehicleName}.`,
      `Fecha: ${dateLabel}.`,
      body.location ? `Lugar: ${body.location}.` : ''
    ].filter(Boolean);

    await notifyUcariano({
      notionToken,
      notificationsDb: process.env.NOTION_NOTIFICATIONS_DATABASE_ID,
      title: `Nueva cita agendada: ${resolvedVehicleName || vehicleName}`,
      message: messageParts.join(' '),
      date,
      personaId: advisorId,
      vehicleId
    });

    return Response.json(
      { id: createPayload.id, skipped },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al crear la cita en Notion.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al crear la cita.' },
      { status: 500 }
    );
  }
}

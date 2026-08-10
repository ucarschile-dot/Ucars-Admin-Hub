import { mockDataset } from '@/lib/mock-data';

type NotionProperty = Record<string, unknown> & {
  type?: string;
  rich_text?: Array<{ plain_text?: string }>;
  title?: Array<{ plain_text?: string }>;
  select?: { name?: string };
  status?: { name?: string };
  date?: { start?: string | null } | null;
};

type NotionRow = {
  id: string;
  properties: Record<string, NotionProperty>;
};

type AgendaItem = {
  id: string;
  customerName: string;
  vehicleLabel: string;
  advisorName: string;
  date: string;
  location: string;
  status: string;
  channel: string;
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

  if (property.select?.name) {
    return property.select.name;
  }

  if (property.status?.name) {
    return property.status.name;
  }

  if (property.date?.start) {
    return property.date.start || '';
  }

  return '';
}

function pickProperty(properties: Record<string, NotionProperty>, candidates: string[]) {
  return candidates.map((candidate) => properties[candidate]).find(Boolean);
}

function toAgendaItem(row: NotionRow): AgendaItem {
  const properties = row.properties;

  const customerName = getText(pickProperty(properties, ['Cliente', 'Customer', 'Nombre cliente'])) || 'Cliente sin nombre';
  const vehicleLabel =
    getText(pickProperty(properties, ['Vehículo', 'Vehiculo', 'Vehicle', 'Auto'])) || 'Vehiculo no informado';
  const advisorName =
    getText(pickProperty(properties, ['Ucariano', 'Advisor', 'Ejecutivo', 'Asesor'])) || 'Sin asesor';
  const date =
    getText(pickProperty(properties, ['Fecha', 'Date', 'Fecha visita', 'Fecha test drive'])) || new Date().toISOString();
  const location =
    getText(pickProperty(properties, ['Lugar', 'Location', 'Sucursal'])) || 'Por definir';
  const status = getText(pickProperty(properties, ['Estado', 'Status'])) || 'Pendiente';
  const channel = getText(pickProperty(properties, ['Canal', 'Channel'])) || 'Sucursal';

  return {
    id: row.id,
    customerName,
    vehicleLabel,
    advisorName,
    date,
    location,
    status,
    channel
  };
}

async function queryAgendaRows(databaseId: string) {
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
      throw new Error(payload.message || 'No se pudo consultar la base de agenda en Notion.');
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
    advisorName: item.advisorName,
    date: item.date,
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
    const rows = await queryAgendaRows(agendaDb);
    const agenda = sortByDate(rows.map(toAgendaItem));

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

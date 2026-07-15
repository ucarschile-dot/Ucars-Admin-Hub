import { mockDataset } from '@/lib/mock-data';

type NotionProperty = Record<string, unknown> & {
  type?: string;
  rich_text?: Array<{ plain_text?: string }>;
  title?: Array<{ plain_text?: string }>;
  select?: { name?: string };
  status?: { name?: string };
  multi_select?: Array<{ name?: string }>;
  number?: number | null;
  url?: string | null;
  files?: Array<{
    type?: 'external' | 'file';
    external?: { url?: string };
    file?: { url?: string };
  }>;
};

type NotionRow = {
  id: string;
  properties: Record<string, NotionProperty>;
};

type StockCardItem = {
  id: string;
  name: string;
  year: string;
  mileage: string;
  engine: string;
  transmission: string;
  assignedUcariano: string;
  photoUrl: string;
  price: string;
  status: string;
};

const PLACEHOLDER_IMAGE = 'https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg';

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

  if (Array.isArray(property.multi_select) && property.multi_select.length > 0) {
    return property.multi_select.map((item) => item.name || '').filter(Boolean).join(', ');
  }

  if (typeof property.url === 'string') {
    return property.url;
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

  const text = getText(property).replace(/[^\d.-]/g, '');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickProperty(properties: Record<string, NotionProperty>, candidates: string[]) {
  return candidates.map((candidate) => properties[candidate]).find(Boolean);
}

function extractFirstUrl(property?: NotionProperty | null) {
  if (!property) {
    return '';
  }

  if (Array.isArray(property.files) && property.files.length > 0) {
    const fromFiles = property.files
      .map((item) => item.external?.url || item.file?.url || '')
      .find(Boolean);

    if (fromFiles) {
      return fromFiles;
    }
  }

  if (typeof property.url === 'string' && property.url.startsWith('http')) {
    return property.url;
  }

  const text = getText(property);
  const matched = text.match(/https?:\/\/[^\s,;]+/i);
  return matched ? matched[0] : '';
}

function toCard(row: NotionRow): StockCardItem {
  const properties = row.properties;

  const brand = getText(pickProperty(properties, ['Marca', 'Brand']));
  const model = getText(pickProperty(properties, ['Vehículo', 'Vehiculo', 'Modelo', 'Model', 'Vehicle', 'Nombre', 'Name']));
  const version = getText(pickProperty(properties, ['Versión', 'Version', 'Trim']));
  const yearNumber = getNumber(pickProperty(properties, ['Año', 'Ano', 'Year']));
  const mileageNumber = getNumber(pickProperty(properties, ['Kilometraje', 'Km', 'Mileage']));
  const engine = getText(pickProperty(properties, ['Motor', 'Engine', 'Motorización', 'Motorizacion'])) || 'No especificado';
  const transmission = getText(pickProperty(properties, ['Transmisión', 'Transmision', 'Transmission', 'Caja'])) || 'No especificada';
  const assignedUcariano =
    getText(pickProperty(properties, ['Ucariano Asignado', 'Ucariano', 'Advisor', 'Ejecutivo', 'Asignado'])) || 'Sin asignar';
  const photoUrl =
    extractFirstUrl(
      pickProperty(properties, ['Fotos URL', 'Foto URL', 'Fotos', 'Foto', 'Imagen', 'Image', 'Photos'])
    ) || PLACEHOLDER_IMAGE;
  const priceNumber = getNumber(pickProperty(properties, ['Precio Actual', 'Precio', 'Price']));
  const status = getText(pickProperty(properties, ['Estado', 'Status'])) || 'Disponible';

  const composedName = [brand, model, version].filter(Boolean).join(' ').trim();

  return {
    id: row.id,
    name: composedName || model || 'Vehiculo sin nombre',
    year: yearNumber > 0 ? String(yearNumber) : '-',
    mileage: mileageNumber > 0 ? `${mileageNumber.toLocaleString('es-CL')} km` : '-',
    engine,
    transmission,
    assignedUcariano,
    photoUrl,
    price: priceNumber > 0 ? `$${priceNumber.toLocaleString('es-CL')}` : '',
    status
  };
}

async function queryStockRows(databaseId: string) {
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
      throw new Error(payload.message || 'No se pudo consultar la base de stock en Notion.');
    }

    rows.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
  } while (cursor);

  return rows;
}

function fallbackCards(): StockCardItem[] {
  return mockDataset.stock.map((item) => ({
    id: item.id,
    name: [item.brand, item.model, item.version].filter(Boolean).join(' '),
    year: String(item.year),
    mileage: `${item.mileage.toLocaleString('es-CL')} km`,
    engine: 'No especificado',
    transmission: 'No especificada',
    assignedUcariano: item.assignedAdvisor,
    photoUrl: PLACEHOLDER_IMAGE,
    price: item.price > 0 ? `$${item.price.toLocaleString('es-CL')}` : '',
    status: item.status
  }));
}

export async function GET() {
  const stockDb = process.env.NOTION_STOCK_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!stockDb || !notionToken) {
    return Response.json(
      { source: 'mock', vehicles: fallbackCards() },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  try {
    const rows = await queryStockRows(stockDb);
    const cards = rows.map(toCard);

    return Response.json(
      { source: 'notion', vehicles: cards },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('Error al consultar Stock en Notion. Se usa fallback mock.', error);

    return Response.json(
      { source: 'mock', vehicles: fallbackCards() },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}

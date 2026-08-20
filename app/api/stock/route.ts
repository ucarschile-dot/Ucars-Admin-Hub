import { mockDataset } from '@/lib/mock-data';

type NotionProperty = Record<string, unknown> & {
  type?: string;
  rich_text?: Array<{ plain_text?: string }>;
  title?: Array<{ plain_text?: string }>;
  select?: { name?: string };
  status?: { name?: string };
  multi_select?: Array<{ name?: string }>;
  people?: Array<{ name?: string; person?: { email?: string } }>;
  relation?: Array<{ id?: string }>;
  formula?: { string?: string | null; number?: number | null; boolean?: boolean | null } | null;
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
  brand: string;
  name: string;
  year: string;
  mileage: string;
  engine: string;
  transmission: string;
  assignedUcariano: string;
  assignedUcarianoId: string | null;
  photoUrl: string;
  price: string;
  status: string;
};

const PLACEHOLDER_IMAGE = 'https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg';

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

  if (Array.isArray(property.people) && property.people.length > 0) {
    const peopleNames = property.people
      .map((item) => item.name || item.person?.email || '')
      .filter(Boolean)
      .join(', ')
      .trim();

    if (peopleNames) {
      return peopleNames;
    }
  }

  if (property.formula) {
    if (typeof property.formula.string === 'string' && property.formula.string.trim()) {
      return property.formula.string.trim();
    }

    if (typeof property.formula.number === 'number') {
      return String(property.formula.number);
    }

    if (typeof property.formula.boolean === 'boolean') {
      return property.formula.boolean ? 'Si' : 'No';
    }
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

function getPropertyNameByType(properties: Record<string, NotionProperty>, type: string) {
  return Object.keys(properties).find((key) => properties[key]?.type === type);
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

function resolveAssignedUcarianoId(properties: Record<string, NotionProperty>) {
  const explicit = pickProperty(properties, ASSIGNED_UCARIANO_CANDIDATES);

  if (explicit && Array.isArray(explicit.relation) && explicit.relation.length > 0) {
    return explicit.relation[0]?.id || null;
  }

  const relationPropertyName = getPropertyNameByType(properties, 'relation');
  const relationProperty = relationPropertyName ? properties[relationPropertyName] : undefined;

  if (relationProperty && Array.isArray(relationProperty.relation) && relationProperty.relation.length > 0) {
    return relationProperty.relation[0]?.id || null;
  }

  return null;
}

function resolveAssignedUcariano(properties: Record<string, NotionProperty>, userNameMap: Map<string, string>) {
  const explicit = pickProperty(properties, ASSIGNED_UCARIANO_CANDIDATES);

  if (explicit) {
    const explicitText = getText(explicit);
    if (explicitText) {
      return explicitText;
    }

    if (Array.isArray(explicit.people) && explicit.people.length > 0) {
      const names = explicit.people
        .map((person) => person.name || person.person?.email || '')
        .filter(Boolean)
        .join(', ')
        .trim();

      if (names) {
        return names;
      }
    }

    if (Array.isArray(explicit.relation) && explicit.relation.length > 0) {
      const relationNames = explicit.relation
        .map((item) => userNameMap.get(item.id || '') || '')
        .filter(Boolean)
        .join(', ')
        .trim();

      if (relationNames) {
        return relationNames;
      }
    }
  }

  // Fallback: find any relation field and attempt to map it with the users database.
  const relationPropertyName = getPropertyNameByType(properties, 'relation');
  const relationProperty = relationPropertyName ? properties[relationPropertyName] : undefined;
  if (relationProperty && Array.isArray(relationProperty.relation) && relationProperty.relation.length > 0) {
    const relationNames = relationProperty.relation
      .map((item) => userNameMap.get(item.id || '') || '')
      .filter(Boolean)
      .join(', ')
      .trim();

    if (relationNames) {
      return relationNames;
    }
  }

  return 'Sin asignar';
}

function toCard(row: NotionRow, userNameMap: Map<string, string>): StockCardItem {
  const properties = row.properties;

  const brand = getText(pickProperty(properties, ['Marca', 'Brand']));
  const model = getText(pickProperty(properties, ['Vehículo', 'Vehiculo', 'Modelo', 'Model', 'Vehicle', 'Nombre', 'Name']));
  const version = getText(pickProperty(properties, ['Versión', 'Version', 'Trim']));
  const yearNumber = getNumber(pickProperty(properties, ['Año', 'Ano', 'Year']));
  const mileageNumber = getNumber(pickProperty(properties, ['Kilometraje', 'Km', 'Mileage']));
  const engine = getText(pickProperty(properties, ['Motor', 'Engine', 'Motorización', 'Motorizacion'])) || 'No especificado';
  const transmission = getText(pickProperty(properties, ['Transmisión', 'Transmision', 'Transmission', 'Caja'])) || 'No especificada';
  const assignedUcariano = resolveAssignedUcariano(properties, userNameMap);
  const photoUrl =
    extractFirstUrl(
      pickProperty(properties, ['Fotos URL', 'Foto URL', 'Fotos', 'Foto', 'Imagen', 'Image', 'Photos'])
    ) || PLACEHOLDER_IMAGE;
  const priceNumber = getNumber(
    pickProperty(properties, ['Precio Publicado', 'Precio publicado', 'Precio Actual', 'Precio', 'Published Price', 'Price'])
  );
  const status = getText(pickProperty(properties, ['Estado', 'Status'])) || 'Disponible';

  const composedName = [model, version].filter(Boolean).join(' ').trim();

  return {
    id: row.id,
    brand: brand || 'Sin marca',
    name: composedName || model || 'Vehiculo sin nombre',
    year: yearNumber > 0 ? String(yearNumber) : '-',
    mileage: mileageNumber > 0 ? `${mileageNumber.toLocaleString('es-CL')} km` : '-',
    engine,
    transmission,
    assignedUcariano,
    assignedUcarianoId: resolveAssignedUcarianoId(properties),
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
    brand: item.brand || 'Sin marca',
    name: [item.brand, item.model, item.version].filter(Boolean).join(' '),
    year: String(item.year),
    mileage: `${item.mileage.toLocaleString('es-CL')} km`,
    engine: 'No especificado',
    transmission: 'No especificada',
    assignedUcariano: item.assignedAdvisor,
    assignedUcarianoId: null,
    photoUrl: PLACEHOLDER_IMAGE,
    price: item.price > 0 ? `$${item.price.toLocaleString('es-CL')}` : '',
    status: item.status
  }));
}

export async function GET() {
  const stockDb = process.env.NOTION_STOCK_DATABASE_ID;
  const usersDb = process.env.NOTION_USERS_DATABASE_ID;
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
    const [rows, userRows] = await Promise.all([
      queryStockRows(stockDb),
      usersDb ? queryStockRows(usersDb) : Promise.resolve([] as NotionRow[])
    ]);
    const userNameMap = buildUserNameMap(userRows);
    const cards = rows.map((row) => toCard(row, userNameMap));

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

export async function PATCH(request: Request) {
  const stockDb = process.env.NOTION_STOCK_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!stockDb || !notionToken) {
    return Response.json({ error: 'Notion no esta configurado en esta app.' }, { status: 503 });
  }

  let body: { vehicleId?: string; ucarianoId?: string | null; ucarianoName?: string | null };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud invalido.' }, { status: 400 });
  }

  const vehicleId = body.vehicleId?.trim();
  const ucarianoId = body.ucarianoId?.trim() || null;
  const ucarianoName = body.ucarianoName?.trim() || '';

  if (!vehicleId) {
    return Response.json({ error: 'Falta el identificador del vehiculo.' }, { status: 400 });
  }

  try {
    const schemaResponse = await fetch(`https://api.notion.com/v1/databases/${stockDb}`, {
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28'
      },
      cache: 'no-store'
    });

    const schema = (await schemaResponse.json()) as {
      properties?: Record<string, { type?: string }>;
      message?: string;
    };

    if (!schemaResponse.ok || !schema.properties) {
      throw new Error(schema.message || 'No se pudo leer el esquema de Stock en Notion.');
    }

    const properties = schema.properties;
    const propertyName =
      ASSIGNED_UCARIANO_CANDIDATES.find((candidate) => Boolean(properties[candidate])) ||
      Object.keys(properties).find((key) => {
        const type = properties[key]?.type;
        return (
          (type === 'relation' || type === 'select' || type === 'multi_select' || type === 'rich_text') &&
          /ucariano|advisor|ejecutivo|asignad/i.test(key)
        );
      });

    if (!propertyName) {
      return Response.json(
        { error: 'No se encontro la propiedad de Ucariano Asignado en la base de Stock de Notion.' },
        { status: 422 }
      );
    }

    const propertyType = properties[propertyName]?.type;
    let propertyValue: Record<string, unknown>;

    switch (propertyType) {
      case 'relation':
        propertyValue = { relation: ucarianoId ? [{ id: ucarianoId }] : [] };
        break;
      case 'select':
        propertyValue = { select: ucarianoName ? { name: ucarianoName } : null };
        break;
      case 'multi_select':
        propertyValue = { multi_select: ucarianoName ? [{ name: ucarianoName }] : [] };
        break;
      case 'rich_text':
        propertyValue = { rich_text: ucarianoName ? [{ type: 'text', text: { content: ucarianoName } }] : [] };
        break;
      default:
        return Response.json(
          { error: `El tipo de propiedad "${propertyType}" no esta soportado para asignar ucarianos.` },
          { status: 422 }
        );
    }

    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${vehicleId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          [propertyName]: propertyValue
        }
      })
    });

    const updatePayload = (await updateResponse.json()) as { message?: string };

    if (!updateResponse.ok) {
      throw new Error(updatePayload.message || 'No se pudo actualizar el vehiculo en Notion.');
    }

    return Response.json(
      {
        vehicleId,
        assignedUcariano: ucarianoName || 'Sin asignar',
        assignedUcarianoId: ucarianoId
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al asignar ucariano en Notion.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al asignar ucariano.' },
      { status: 500 }
    );
  }
}

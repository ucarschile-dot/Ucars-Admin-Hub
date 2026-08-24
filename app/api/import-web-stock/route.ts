const DEFAULT_PUBLIC_SITE_URL = 'https://ucars.cl';

type WebVehicle = {
  id: string;
  marca?: string;
  modelo?: string;
  version?: string;
  tipo?: string;
  año?: number;
  precio?: number;
  km?: number;
  combustible?: string;
  transmision?: string;
  color?: string;
  estado?: string;
  badge?: string;
  imagen?: string;
  dias_en_stock?: number;
  created_at?: string;
};

type SchemaProperty = { type?: string };

function getPublicSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || DEFAULT_PUBLIC_SITE_URL).replace(/\/$/, '');
}

export async function GET() {
  const baseUrl = getPublicSiteUrl();

  try {
    const response = await fetch(`${baseUrl}/api/stock`, { cache: 'no-store' });
    const payload = (await response.json()) as WebVehicle[] | { error?: string };

    if (!response.ok || !Array.isArray(payload)) {
      const message = !Array.isArray(payload) ? payload.error : undefined;
      throw new Error(message || 'No se pudo consultar el stock del sitio web.');
    }

    return Response.json(
      { source: baseUrl, vehicles: payload },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al consultar el stock del sitio web.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al consultar el sitio web.' },
      { status: 502 }
    );
  }
}

async function getDatabaseSchema(databaseId: string, notionToken: string) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28'
    },
    cache: 'no-store'
  });

  const schema = (await response.json()) as {
    properties?: Record<string, SchemaProperty>;
    message?: string;
  };

  if (!response.ok || !schema.properties) {
    throw new Error(schema.message || 'No se pudo leer el esquema de Stock en Notion.');
  }

  return schema.properties;
}

function findPropertyName(properties: Record<string, SchemaProperty>, candidates: string[]) {
  return candidates.find((candidate) => Boolean(properties[candidate]));
}

function getTitlePropertyName(properties: Record<string, SchemaProperty>) {
  return Object.keys(properties).find((key) => properties[key]?.type === 'title');
}

function buildPropertyValue(type: string | undefined, rawValue: string | number | undefined) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }

  switch (type) {
    case 'rich_text':
      return { rich_text: [{ text: { content: String(rawValue) } }] };
    case 'number': {
      const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      return Number.isFinite(numeric) ? { number: numeric } : undefined;
    }
    case 'select':
      return { select: { name: String(rawValue) } };
    case 'status':
      return { status: { name: String(rawValue) } };
    case 'multi_select':
      return { multi_select: [{ name: String(rawValue) }] };
    case 'url':
      return { url: String(rawValue) };
    default:
      return undefined;
  }
}

export async function POST(request: Request) {
  const stockDb = process.env.NOTION_STOCK_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!stockDb || !notionToken) {
    return Response.json({ error: 'Notion no esta configurado en esta app.' }, { status: 503 });
  }

  let body: { vehicles?: WebVehicle[] };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud invalido.' }, { status: 400 });
  }

  const vehicles = Array.isArray(body.vehicles) ? body.vehicles : [];

  if (vehicles.length === 0) {
    return Response.json({ error: 'No se enviaron vehiculos para importar.' }, { status: 400 });
  }

  try {
    const schemaProperties = await getDatabaseSchema(stockDb, notionToken);
    const titlePropName = getTitlePropertyName(schemaProperties);

    const created: string[] = [];
    const failed: Array<{ vehicle: string; error: string }> = [];

    for (const vehicle of vehicles) {
      const composedName = [vehicle.marca, vehicle.modelo, vehicle.version].filter(Boolean).join(' ').trim() || 'Vehiculo importado';

      const properties: Record<string, unknown> = {};

      if (titlePropName) {
        properties[titlePropName] = { title: [{ text: { content: composedName } }] };
      }

      const fields: Array<{ candidates: string[]; rawValue: string | number | undefined }> = [
        { candidates: ['Marca', 'Brand'], rawValue: vehicle.marca },
        { candidates: ['Versión', 'Version', 'Trim'], rawValue: vehicle.version },
        { candidates: ['Año', 'Ano', 'Year'], rawValue: vehicle.año },
        { candidates: ['Precio Publicado', 'Precio publicado', 'Precio Actual', 'Precio', 'Price'], rawValue: vehicle.precio },
        { candidates: ['Kilometraje', 'Km', 'Mileage'], rawValue: vehicle.km },
        { candidates: ['Transmisión', 'Transmision', 'Transmission', 'Caja'], rawValue: vehicle.transmision },
        { candidates: ['Combustible', 'Fuel', 'Fuel Type'], rawValue: vehicle.combustible },
        { candidates: ['Tipo', 'Type', 'Categoria', 'Categoría'], rawValue: vehicle.tipo },
        { candidates: ['Color'], rawValue: vehicle.color },
        { candidates: ['Estado', 'Status'], rawValue: vehicle.estado || 'Disponible' },
        {
          candidates: ['Fotos URL', 'Foto URL', 'Fotos', 'Foto', 'Imagen', 'Image', 'Photos'],
          rawValue: vehicle.imagen
        }
      ];

      fields.forEach((field) => {
        const propName = findPropertyName(schemaProperties, field.candidates);
        if (!propName) {
          return;
        }

        const value = buildPropertyValue(schemaProperties[propName]?.type, field.rawValue);
        if (value) {
          properties[propName] = value;
        }
      });

      try {
        const createResponse = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${notionToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            parent: { database_id: stockDb },
            properties
          })
        });

        const createPayload = (await createResponse.json()) as { id?: string; message?: string };

        if (!createResponse.ok || !createPayload.id) {
          throw new Error(createPayload.message || 'No se pudo crear el vehiculo en Notion.');
        }

        created.push(createPayload.id);
      } catch (error) {
        failed.push({
          vehicle: composedName,
          error: error instanceof Error ? error.message : 'Error desconocido al importar el vehiculo.'
        });
      }
    }

    return Response.json(
      { created: created.length, createdIds: created, failed },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al importar stock desde el sitio web.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al importar el stock.' },
      { status: 500 }
    );
  }
}

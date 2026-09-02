import { NOTION_VERSION, getDataSourceSchema, resolveDataSourceId, notionApiFetch } from '@/lib/notion-data-source';

type NotionSchemaProperty = { type?: string };

const NAME_CANDIDATES = ['Nombre', 'Name'];
const RUT_CANDIDATES = ['RUT', 'Rut', 'RUN', 'Run', 'Documento'];
const EMAIL_CANDIDATES = ['Email', 'Correo', 'Mail'];
const PHONE_CANDIDATES = ['Teléfono', 'Telefono', 'Phone', 'Celular'];
const CITY_CANDIDATES = ['Ciudad', 'City', 'Sucursal'];
const ADDRESS_CANDIDATES = ['Dirección Casa', 'Direccion Casa', 'Dirección', 'Direccion', 'Domicilio', 'Address'];
const BIRTHDATE_CANDIDATES = ['Fecha de Nacimiento', 'Fecha Nacimiento', 'Fecha de nacimiento', 'Cumpleaños', 'Cumpleanos'];
const ENTRY_DATE_CANDIDATES = ['Fecha de Ingreso', 'Fecha Ingreso', 'Fecha de ingreso', 'Ingreso'];
const POSTULATION_STATUS_CANDIDATES = [
  'Estado Postulación',
  'Estado Postulacion',
  'Postulation Status',
  'Estado de Postulación',
  'Estado de Postulacion'
];

type PostulanteInput = {
  nombre_completo?: string;
  rut?: string;
  correo_electronico?: string;
  numero_de_telefono?: string;
  ciudad?: string;
};

type ManualUcarianoInput = {
  nombre?: string;
  telefono?: string;
  email?: string;
  rut?: string;
  direccionCasa?: string;
  fechaNacimiento?: string;
};

function findPropertyName(properties: Record<string, NotionSchemaProperty>, candidates: string[]) {
  return candidates.find((candidate) => Boolean(properties[candidate]));
}

function getTitlePropertyName(properties: Record<string, NotionSchemaProperty>) {
  return Object.keys(properties).find((key) => properties[key]?.type === 'title');
}

function buildPropertyValue(type: string | undefined, raw: unknown) {
  switch (type) {
    case 'title':
      return { title: raw ? [{ text: { content: String(raw) } }] : [] };
    case 'rich_text':
      return { rich_text: raw ? [{ text: { content: String(raw) } }] : [] };
    case 'email':
      return { email: raw ? String(raw) : null };
    case 'phone_number':
      return { phone_number: raw ? String(raw) : null };
    case 'url':
      return { url: raw ? String(raw) : null };
    case 'number': {
      const numeric = Number(raw);
      return { number: Number.isFinite(numeric) ? numeric : null };
    }
    case 'checkbox':
      return { checkbox: Boolean(raw) };
    case 'select':
      return raw ? { select: { name: String(raw) } } : { select: null };
    case 'status':
      return raw ? { status: { name: String(raw) } } : { status: null };
    case 'multi_select':
      return { multi_select: (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean).map((item) => ({ name: String(item) })) };
    case 'date':
      return raw ? { date: { start: String(raw) } } : { date: null };
    default:
      return undefined;
  }
}

function buildPropertiesFromPostulante(
  schema: Record<string, NotionSchemaProperty>,
  postulante: PostulanteInput
) {
  const properties: Record<string, unknown> = {};

  const titlePropName = getTitlePropertyName(schema);
  const namePropName = findPropertyName(schema, NAME_CANDIDATES);
  if (titlePropName) {
    properties[titlePropName] = buildPropertyValue('title', postulante.nombre_completo || '');
  }
  if (namePropName && namePropName !== titlePropName) {
    properties[namePropName] = buildPropertyValue(schema[namePropName]?.type, postulante.nombre_completo || '');
  }

  const rutPropName = findPropertyName(schema, RUT_CANDIDATES);
  if (rutPropName) {
    properties[rutPropName] = buildPropertyValue(schema[rutPropName]?.type, postulante.rut || '');
  }

  const emailPropName = findPropertyName(schema, EMAIL_CANDIDATES);
  if (emailPropName) {
    properties[emailPropName] = buildPropertyValue(schema[emailPropName]?.type, postulante.correo_electronico || '');
  }

  const phonePropName = findPropertyName(schema, PHONE_CANDIDATES);
  if (phonePropName) {
    properties[phonePropName] = buildPropertyValue(schema[phonePropName]?.type, postulante.numero_de_telefono || '');
  }

  const cityPropName = findPropertyName(schema, CITY_CANDIDATES);
  if (cityPropName) {
    properties[cityPropName] = buildPropertyValue(schema[cityPropName]?.type, postulante.ciudad || '');
  }

  const postulationStatusPropName = findPropertyName(schema, POSTULATION_STATUS_CANDIDATES);
  if (postulationStatusPropName) {
    const type = schema[postulationStatusPropName]?.type;
    if (type === 'select' || type === 'status') {
      properties[postulationStatusPropName] = buildPropertyValue(type, 'Aprobado');
    }
  }

  return properties;
}

function buildPropertiesFromManualInput(
  schema: Record<string, NotionSchemaProperty>,
  input: ManualUcarianoInput
) {
  const properties: Record<string, unknown> = {};

  const titlePropName = getTitlePropertyName(schema);
  const namePropName = findPropertyName(schema, NAME_CANDIDATES);
  if (titlePropName) {
    properties[titlePropName] = buildPropertyValue('title', input.nombre || '');
  }
  if (namePropName && namePropName !== titlePropName) {
    properties[namePropName] = buildPropertyValue(schema[namePropName]?.type, input.nombre || '');
  }

  const rutPropName = findPropertyName(schema, RUT_CANDIDATES);
  if (rutPropName) {
    properties[rutPropName] = buildPropertyValue(schema[rutPropName]?.type, input.rut || '');
  }

  const emailPropName = findPropertyName(schema, EMAIL_CANDIDATES);
  if (emailPropName) {
    properties[emailPropName] = buildPropertyValue(schema[emailPropName]?.type, input.email || '');
  }

  const phonePropName = findPropertyName(schema, PHONE_CANDIDATES);
  if (phonePropName) {
    properties[phonePropName] = buildPropertyValue(schema[phonePropName]?.type, input.telefono || '');
  }

  const addressPropName = findPropertyName(schema, ADDRESS_CANDIDATES);
  if (addressPropName) {
    properties[addressPropName] = buildPropertyValue(schema[addressPropName]?.type, input.direccionCasa || '');
  }

  const birthdatePropName = findPropertyName(schema, BIRTHDATE_CANDIDATES);
  if (birthdatePropName && input.fechaNacimiento) {
    properties[birthdatePropName] = buildPropertyValue('date', input.fechaNacimiento);
  }

  return properties;
}

// La fecha de ingreso siempre es la fecha de aprobacion (hoy), nunca un dato pedido en el formulario.
function applyEntryDate(schema: Record<string, NotionSchemaProperty>, properties: Record<string, unknown>) {
  const entryDatePropName = findPropertyName(schema, ENTRY_DATE_CANDIDATES);
  if (entryDatePropName) {
    properties[entryDatePropName] = buildPropertyValue('date', new Date().toISOString().slice(0, 10));
  }
}

// Crea un Ucariano en Notion a partir de un postulante aprobado del Sheet, o desde un formulario manual.
export async function POST(request: Request) {
  const databaseId = process.env.NOTION_USERS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!databaseId || !notionToken) {
    return Response.json({ error: 'Notion no esta configurado en esta app.' }, { status: 503 });
  }

  let body: {
    mode?: 'fromPostulante' | 'manual';
    postulante?: PostulanteInput;
    manual?: ManualUcarianoInput;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud invalido.' }, { status: 400 });
  }

  try {
    const schema = await getDataSourceSchema(databaseId, notionToken);

    const properties =
      body.mode === 'manual'
        ? buildPropertiesFromManualInput(schema, body.manual || {})
        : buildPropertiesFromPostulante(schema, body.postulante || {});

    if (Object.keys(properties).length === 0) {
      return Response.json({ error: 'No hay campos validos para crear el ucariano.' }, { status: 422 });
    }

    applyEntryDate(schema, properties);

    const dataSourceId = await resolveDataSourceId(databaseId, notionToken);
    const response = await notionApiFetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { data_source_id: dataSourceId },
        properties
      })
    });

    const payload = (await response.json()) as { id?: string; message?: string };

    if (!response.ok || !payload.id) {
      throw new Error(payload.message || 'No se pudo crear el ucariano en Notion.');
    }

    return Response.json({ id: payload.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al crear el ucariano en Notion.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al crear el ucariano.' },
      { status: 500 }
    );
  }
}

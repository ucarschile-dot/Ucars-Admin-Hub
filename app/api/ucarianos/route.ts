import { mockDataset } from '@/lib/mock-data';

type NotionProperty = Record<string, unknown> & {
  type?: string;
  rich_text?: Array<{ plain_text?: string }>;
  title?: Array<{ plain_text?: string }>;
  select?: { name?: string };
  status?: { name?: string };
  number?: number | null;
  email?: string | null;
  phone_number?: string | null;
  url?: string | null;
  checkbox?: boolean;
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

type UcarianoCard = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  branch: string;
  status: string;
  assignedCars: number;
  avatarUrl: string;
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

  if (typeof property.email === 'string') {
    return property.email;
  }

  if (typeof property.phone_number === 'string') {
    return property.phone_number;
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

  const parsed = Number(getText(property).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickProperty(properties: Record<string, NotionProperty>, candidates: string[]) {
  return candidates.map((candidate) => properties[candidate]).find(Boolean);
}

function getPropertyByType(properties: Record<string, NotionProperty>, type: string) {
  const key = Object.keys(properties).find((name) => properties[name]?.type === type);
  return key ? properties[key] : undefined;
}

function extractAvatar(property?: NotionProperty | null) {
  if (!property) {
    return PLACEHOLDER_IMAGE;
  }

  if (Array.isArray(property.files) && property.files.length > 0) {
    const direct = property.files
      .map((item) => item.external?.url || item.file?.url || '')
      .find(Boolean);

    if (direct) {
      return direct;
    }
  }

  const directUrl = getText(property);
  if (directUrl.startsWith('http')) {
    return directUrl;
  }

  return PLACEHOLDER_IMAGE;
}

function isActiveStatus(value: string) {
  const normalized = (value || '').toLowerCase().trim();
  if (!normalized) {
    return true;
  }

  if (isApplicantStatus(normalized)) {
    return false;
  }

  if (/(paus|inact|leave|vacac|suspend|desactiv)/i.test(normalized)) {
    return false;
  }

  return /(activo|active|habilitado|disponible|vigente)/i.test(normalized);
}

function isApplicantStatus(value: string) {
  const normalized = (value || '').toLowerCase().trim();
  if (!normalized) {
    return false;
  }

  return /(postul|applicant|onboard|candidat|proceso|entrevist|selecci)/i.test(normalized);
}

function normalizeStatus(properties: Record<string, NotionProperty>) {
  const status = getText(
    pickProperty(properties, ['Estado', 'Status', 'Estado Ucariano', 'Estado asesor']) ||
      getPropertyByType(properties, 'status') ||
      getPropertyByType(properties, 'select')
  );

  const activeFlag = pickProperty(properties, ['Activo', 'Active']);
  if (typeof activeFlag?.checkbox === 'boolean') {
    return activeFlag.checkbox ? 'Activo' : 'Pausado';
  }

  return status || 'Activo';
}

function toCard(row: NotionRow): UcarianoCard | null {
  const properties = row.properties;

  const status = normalizeStatus(properties);

  const name =
    getText(pickProperty(properties, ['Nombre', 'Name', 'Ucariano'])) ||
    getText(getPropertyByType(properties, 'title')) ||
    'Sin nombre';

  const email = getText(pickProperty(properties, ['Email', 'Correo', 'Mail'])) || 'Sin correo';
  const phone = getText(pickProperty(properties, ['Teléfono', 'Telefono', 'Phone', 'Celular'])) || 'Sin teléfono';
  const role = getText(pickProperty(properties, ['Cargo', 'Rol', 'Role', 'Puesto'])) || 'Ucariano';
  const branch = getText(pickProperty(properties, ['Sucursal', 'Branch', 'Sede'])) || 'Sin sucursal';
  const assignedCars = getNumber(
    pickProperty(properties, [
      'Autos Asignados',
      'Vehiculos Asignados',
      'Vehículos Asignados',
      'Assigned Cars',
      'Negocios Activos',
      'Active Deals'
    ])
  );

  const avatarUrl = extractAvatar(
    pickProperty(properties, ['Foto', 'Foto Perfil', 'Avatar', 'Imagen', 'Image', 'Photo'])
  );

  return {
    id: row.id,
    name,
    email,
    phone,
    role,
    branch,
    status,
    assignedCars,
    avatarUrl
  };
}

async function queryRows(databaseId: string) {
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
      throw new Error(payload.message || 'No se pudo consultar la base de Ucarianos en Notion.');
    }

    rows.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
  } while (cursor);

  return rows;
}

function fallbackCards() {
  return mockDataset.ucarianos
    .filter((item) => item.status === 'Activo')
    .map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      role: 'Ucariano',
      branch: item.branch,
      status: item.status,
      assignedCars: item.activeDeals,
      avatarUrl: PLACEHOLDER_IMAGE
    }));
}

function fallbackApplicants() {
  return mockDataset.ucarianos
    .filter((item) => item.status === 'Onboarding')
    .map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      role: 'Postulante',
      branch: item.branch,
      status: item.status,
      assignedCars: 0,
      avatarUrl: PLACEHOLDER_IMAGE
    }));
}

export async function GET() {
  const usersDb = process.env.NOTION_USERS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!usersDb || !notionToken) {
    return Response.json(
      {
        source: 'mock',
        ucarianos: fallbackCards(),
        postulantes: fallbackApplicants()
      },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  try {
    const rows = await queryRows(usersDb);
    const cards = rows
      .map(toCard)
      .filter((item): item is UcarianoCard => item !== null);

    const ucarianos = cards.filter((item) => isActiveStatus(item.status));
    const postulantes = cards.filter((item) => isApplicantStatus(item.status));

    return Response.json(
      { source: 'notion', ucarianos, postulantes },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('Error al consultar Ucarianos en Notion. Se usa fallback mock.', error);

    return Response.json(
      {
        source: 'mock',
        ucarianos: fallbackCards(),
        postulantes: fallbackApplicants()
      },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
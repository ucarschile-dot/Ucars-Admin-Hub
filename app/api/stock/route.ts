import { mockDataset } from '@/lib/mock-data';

const DEFAULT_PUBLIC_SITE_URL = 'https://ucars.cl';
const DEFAULT_VEEKLS_API_URL = 'https://public.api.veekls.com';
const VEEKLS_PAGE_SIZE = 50;

const WEB_SOURCE_ID_CANDIDATES = ['ID Web', 'ID Ucars', 'ID Externo', 'External ID', 'Source ID', 'Vehicle ID'];

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
  publicationUrl: string;
};

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
  url?: string;
};

type VeeklsVehicle = {
  _id: string;
  brand?: string;
  model?: string;
  version?: unknown;
  type?: string;
  year?: number;
  price?: number;
  odometer?: number;
  fuel?: string;
  gearbox?: string;
  color?: string;
  reservedAt?: string | null;
  soldAt?: string | null;
  pictures?: string[];
};

type NotionSchemaProperty = { type?: string };

const PLACEHOLDER_IMAGE = 'https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg';

const PUBLICATION_URL_CANDIDATES = ['URL publicación', 'URL Publicacion', 'URL publicacion', 'URL', 'Url'];

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

function getPublicSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || DEFAULT_PUBLIC_SITE_URL).replace(/\/$/, '');
}

function getWebApiHeaders() {
  const apiKey = process.env.UCARS_API_KEY?.trim();

  if (!apiKey) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey
  };
}

function getVeeklsConfig() {
  const orgId = process.env.VEEKLS_ORG_ID?.trim();
  const secret = process.env.VEEKLS_SECRET_KEY?.trim();
  const basicAuthRaw = process.env.VEEKLS_BASIC_AUTH?.trim();
  const apiUrl = (process.env.VEEKLS_API_URL || DEFAULT_VEEKLS_API_URL).replace(/\/$/, '');

  if (basicAuthRaw) {
    const basicToken = basicAuthRaw.toLowerCase().startsWith('basic ')
      ? basicAuthRaw.slice(6).trim()
      : basicAuthRaw;

    if (!basicToken) {
      throw new Error('VEEKLS_BASIC_AUTH esta vacio.');
    }

    return { apiUrl, authHeader: `Basic ${basicToken}` };
  }

  if (!orgId || !secret) {
    return null;
  }

  const secretWithoutPrefix = secret.toLowerCase().startsWith('basic ')
    ? secret.slice(6).trim()
    : secret;

  // Compatibility: some accounts provide a pre-built base64 token instead of the raw secret key.
  const decodedCandidate = Buffer.from(secretWithoutPrefix, 'base64').toString('utf8');
  if (decodedCandidate.startsWith(`${orgId}:`) && decodedCandidate.split(':').length >= 2) {
    return { apiUrl, authHeader: `Basic ${secretWithoutPrefix}` };
  }

  const authToken = Buffer.from(`${orgId}:${secretWithoutPrefix}`).toString('base64');
  return { apiUrl, authHeader: `Basic ${authToken}` };
}

function decodeVeeklsEnum(value: string | undefined) {
  if (!value) {
    return '';
  }

  const raw = value.includes('.') ? value.split('.').pop() || value : value;
  return raw
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeVeeklsVersion(version: unknown) {
  if (typeof version === 'string') {
    return version;
  }

  if (version && typeof version === 'object' && 'name' in version) {
    const name = (version as { name?: unknown }).name;
    if (typeof name === 'string') {
      return name;
    }
  }

  return '';
}

function mapVeeklsVehicleToWeb(vehicle: VeeklsVehicle): WebVehicle {
  const firstPictureId = Array.isArray(vehicle.pictures) ? vehicle.pictures.find(Boolean) : undefined;
  const image = firstPictureId ? `https://pictures.veekls.com/${firstPictureId}` : undefined;
  const status = vehicle.soldAt ? 'Vendido' : vehicle.reservedAt ? 'Reservado' : 'Disponible';

  return {
    id: String(vehicle._id || ''),
    marca: vehicle.brand,
    modelo: vehicle.model,
    version: normalizeVeeklsVersion(vehicle.version),
    tipo: decodeVeeklsEnum(vehicle.type),
    año: vehicle.year,
    precio: vehicle.price,
    km: vehicle.odometer,
    combustible: decodeVeeklsEnum(vehicle.fuel),
    transmision: decodeVeeklsEnum(vehicle.gearbox),
    color: vehicle.color,
    estado: status,
    imagen: image
  };
}

async function fetchVeeklsStock() {
  const config = getVeeklsConfig();

  if (!config) {
    return null;
  }

  const allVehicles: WebVehicle[] = [];
  let skip = 0;

  while (true) {
    const url = `${config.apiUrl}/vehicles?limit=${VEEKLS_PAGE_SIZE}&skip=${skip}`;
    const response = await fetch(url, {
      headers: {
        Authorization: config.authHeader
      },
      cache: 'no-store'
    });

    const payload = (await response.json()) as VeeklsVehicle[] | { error?: string; message?: string };

    if (response.status === 401) {
      throw new Error(
        'Veekls rechazo las credenciales (401). Usa VEEKLS_BASIC_AUTH con tu token base64 actual o VEEKLS_ORG_ID + VEEKLS_SECRET_KEY crudos.'
      );
    }

    if (!response.ok || !Array.isArray(payload)) {
      const message = !Array.isArray(payload) ? payload.error || payload.message : undefined;
      throw new Error(message || 'No se pudo consultar el stock en Veekls.');
    }

    const mapped = payload.map(mapVeeklsVehicleToWeb).filter((item) => Boolean(item.id));
    allVehicles.push(...mapped);

    if (payload.length < VEEKLS_PAGE_SIZE) {
      break;
    }

    skip += VEEKLS_PAGE_SIZE;
  }

  return allVehicles;
}

async function fetchWebStock() {
  const veeklsVehicles = await fetchVeeklsStock();
  if (veeklsVehicles) {
    return veeklsVehicles;
  }

  const baseUrl = getPublicSiteUrl();
  const response = await fetch(`${baseUrl}/api/stock`, {
    headers: getWebApiHeaders(),
    cache: 'no-store'
  });

  const payload = (await response.json()) as WebVehicle[] | { error?: string };

  if (!response.ok || !Array.isArray(payload)) {
    const message = !Array.isArray(payload) ? payload.error : undefined;
    throw new Error(message || 'No se pudo consultar el stock del sitio web.');
  }

  return payload;
}

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

function pickPropertyName(properties: Record<string, NotionProperty>, candidates: string[]) {
  return candidates.find((candidate) => Boolean(properties[candidate]));
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

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWebVehicleCompositeKey(vehicle: WebVehicle) {
  return normalizeKey([vehicle.marca, vehicle.modelo, vehicle.version, String(vehicle.año || '')].filter(Boolean).join(' '));
}

function getNotionVehicleCompositeKey(properties: Record<string, NotionProperty>) {
  const brand = getText(pickProperty(properties, ['Marca', 'Brand']));
  const model = getText(pickProperty(properties, ['Modelo', 'Model', 'Vehículo', 'Vehiculo', 'Vehicle', 'Nombre', 'Name']));
  const version = getText(pickProperty(properties, ['Versión', 'Version', 'Trim']));
  const year = getText(pickProperty(properties, ['Año', 'Ano', 'Year']));
  return normalizeKey([brand, model, version, year].filter(Boolean).join(' '));
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
  const publicationUrl = extractFirstUrl(pickProperty(properties, PUBLICATION_URL_CANDIDATES));

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
    status,
    publicationUrl
  };
}

function toCardFromWebVehicle(vehicle: WebVehicle, row: NotionRow | undefined, userNameMap: Map<string, string>): StockCardItem {
  const properties = row?.properties || {};
  const rowBrand = getText(pickProperty(properties, ['Marca', 'Brand']));
  const rowModel = getText(pickProperty(properties, ['Modelo', 'Model', 'Vehículo', 'Vehiculo', 'Vehicle', 'Nombre', 'Name']));
  const rowVersion = getText(pickProperty(properties, ['Versión', 'Version', 'Trim']));
  const rowYear = getNumber(pickProperty(properties, ['Año', 'Ano', 'Year']));
  const rowMileage = getNumber(pickProperty(properties, ['Kilometraje', 'Km', 'Mileage']));
  const rowTransmission = getText(pickProperty(properties, ['Transmisión', 'Transmision', 'Transmission', 'Caja']));
  const rowEngine = getText(pickProperty(properties, ['Motor', 'Engine', 'Motorización', 'Motorizacion']));
  const rowPrice = getNumber(
    pickProperty(properties, ['Precio Publicado', 'Precio publicado', 'Precio Actual', 'Precio', 'Published Price', 'Price'])
  );
  const rowStatus = getText(pickProperty(properties, ['Estado', 'Status']));

  const brand = vehicle.marca || rowBrand || 'Sin marca';
  const model = vehicle.modelo || rowModel || '';
  const version = vehicle.version || rowVersion || '';
  const yearNumber = typeof vehicle.año === 'number' ? vehicle.año : rowYear;
  const mileageNumber = typeof vehicle.km === 'number' ? vehicle.km : rowMileage;
  const transmission = vehicle.transmision || rowTransmission || 'No especificada';
  const engine = rowEngine || vehicle.combustible || 'No especificado';
  const priceNumber = typeof vehicle.precio === 'number' ? vehicle.precio : rowPrice;
  const status = vehicle.estado || rowStatus || 'Disponible';
  const publicationUrl = extractFirstUrl(pickProperty(properties, PUBLICATION_URL_CANDIDATES));

  const composedName = [model, version].filter(Boolean).join(' ').trim();

  return {
    id: row?.id || String(vehicle.id || ''),
    brand,
    name: composedName || model || `${brand} sin nombre`,
    year: yearNumber > 0 ? String(yearNumber) : '-',
    mileage: mileageNumber > 0 ? `${mileageNumber.toLocaleString('es-CL')} km` : '-',
    engine,
    transmission,
    assignedUcariano: row ? resolveAssignedUcariano(properties, userNameMap) : 'Sin asignar',
    assignedUcarianoId: row ? resolveAssignedUcarianoId(properties) : null,
    photoUrl:
      vehicle.imagen ||
      extractFirstUrl(pickProperty(properties, ['Fotos URL', 'Foto URL', 'Fotos', 'Foto', 'Imagen', 'Image', 'Photos'])) ||
      PLACEHOLDER_IMAGE,
    price: priceNumber > 0 ? `$${priceNumber.toLocaleString('es-CL')}` : '',
    status,
    publicationUrl
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

async function getDatabaseSchema(databaseId: string, notionToken: string) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28'
    },
    cache: 'no-store'
  });

  const schema = (await response.json()) as {
    properties?: Record<string, NotionSchemaProperty>;
    message?: string;
  };

  if (!response.ok || !schema.properties) {
    throw new Error(schema.message || 'No se pudo leer el esquema de Stock en Notion.');
  }

  return schema.properties;
}

function findPropertyName(properties: Record<string, NotionSchemaProperty>, candidates: string[]) {
  return candidates.find((candidate) => Boolean(properties[candidate]));
}

function getTitlePropertyName(properties: Record<string, NotionSchemaProperty>) {
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

function buildNotionPropertiesFromWebVehicle(
  schemaProperties: Record<string, NotionSchemaProperty>,
  vehicle: WebVehicle,
  sourceIdPropertyName?: string
) {
  const titlePropName = getTitlePropertyName(schemaProperties);
  const composedName = [vehicle.marca, vehicle.modelo, vehicle.version].filter(Boolean).join(' ').trim() || 'Vehiculo importado';
  const properties: Record<string, unknown> = {};

  if (titlePropName) {
    properties[titlePropName] = { title: [{ text: { content: composedName } }] };
  }

  const fields: Array<{ candidates: string[]; rawValue: string | number | undefined }> = [
    { candidates: ['Marca', 'Brand'], rawValue: vehicle.marca },
    { candidates: ['Modelo', 'Model', 'Vehículo', 'Vehiculo', 'Vehicle', 'Nombre', 'Name'], rawValue: vehicle.modelo },
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
    },
    { candidates: ['URL publicación', 'URL Publicacion', 'URL publicacion', 'URL', 'Url'], rawValue: vehicle.url }
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

  if (sourceIdPropertyName && vehicle.id) {
    const value = buildPropertyValue(schemaProperties[sourceIdPropertyName]?.type, String(vehicle.id));
    if (value) {
      properties[sourceIdPropertyName] = value;
    }
  }

  return properties;
}

async function updateNotionPage(pageId: string, notionToken: string, properties: Record<string, unknown>) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ properties })
  });

  const payload = (await response.json()) as { message?: string };

  if (!response.ok) {
    throw new Error(payload.message || 'No se pudo actualizar el vehiculo en Notion.');
  }
}

async function createNotionPage(stockDb: string, notionToken: string, properties: Record<string, unknown>) {
  const response = await fetch('https://api.notion.com/v1/pages', {
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

  const payload = (await response.json()) as { id?: string; message?: string };

  if (!response.ok || !payload.id) {
    throw new Error(payload.message || 'No se pudo crear el vehiculo en Notion.');
  }

  return payload.id;
}

async function archiveNotionPage(pageId: string, notionToken: string) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ archived: true })
  });

  const payload = (await response.json()) as { message?: string };

  if (!response.ok) {
    throw new Error(payload.message || 'No se pudo archivar el vehiculo en Notion.');
  }
}

async function syncWebStockToNotion(
  webVehicles: WebVehicle[],
  existingRows: NotionRow[],
  schemaProperties: Record<string, NotionSchemaProperty>,
  stockDb: string,
  notionToken: string
) {
  const sourceIdPropertyName = findPropertyName(schemaProperties, WEB_SOURCE_ID_CANDIDATES);
  const rowsBySourceId = new Map<string, NotionRow>();
  const rowsByCompositeKey = new Map<string, NotionRow>();
  const webSourceIdCounts = new Map<string, number>();
  const webCompositeKeyCounts = new Map<string, number>();

  function increaseCount(map: Map<string, number>, key: string) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  webVehicles.forEach((vehicle) => {
    const sourceId = String(vehicle.id || '').trim();
    const compositeKey = getWebVehicleCompositeKey(vehicle);

    if (sourceId) {
      increaseCount(webSourceIdCounts, sourceId);
    }

    if (compositeKey) {
      increaseCount(webCompositeKeyCounts, compositeKey);
    }
  });

  existingRows.forEach((row) => {
    if (sourceIdPropertyName) {
      const sourceId = getText(row.properties[sourceIdPropertyName]);
      if (sourceId) {
        rowsBySourceId.set(sourceId, row);
      }
    }

    const compositeKey = getNotionVehicleCompositeKey(row.properties);
    if (compositeKey) {
      rowsByCompositeKey.set(compositeKey, row);
    }
  });

  const failed: Array<{ vehicleId: string; error: string }> = [];
  let archived = 0;

  for (const vehicle of webVehicles) {
    const sourceId = String(vehicle.id || '').trim();
    const compositeKey = getWebVehicleCompositeKey(vehicle);
    const existing = (sourceId && rowsBySourceId.get(sourceId)) || (compositeKey ? rowsByCompositeKey.get(compositeKey) : undefined);
    const properties = buildNotionPropertiesFromWebVehicle(schemaProperties, vehicle, sourceIdPropertyName);

    if (Object.keys(properties).length === 0) {
      continue;
    }

    try {
      if (existing) {
        await updateNotionPage(existing.id, notionToken, properties);
      } else {
        await createNotionPage(stockDb, notionToken, properties);
      }
    } catch (error) {
      failed.push({
        vehicleId: sourceId || compositeKey || 'unknown',
        error: error instanceof Error ? error.message : 'Error desconocido al sincronizar vehiculo.'
      });
    }
  }

  for (const row of existingRows) {
    const sourceId = sourceIdPropertyName ? getText(row.properties[sourceIdPropertyName]).trim() : '';
    const compositeKey = getNotionVehicleCompositeKey(row.properties);

    const sourceIdCount = sourceId ? (webSourceIdCounts.get(sourceId) || 0) : 0;
    const compositeCount = compositeKey ? (webCompositeKeyCounts.get(compositeKey) || 0) : 0;

    // Keep only as many Notion rows as Veekls currently publishes.
    if (sourceIdCount > 0) {
      webSourceIdCounts.set(sourceId, sourceIdCount - 1);
      continue;
    }

    if (compositeCount > 0) {
      webCompositeKeyCounts.set(compositeKey, compositeCount - 1);
      continue;
    }

    // Do not archive rows that cannot be matched deterministically.
    if (!sourceId && !compositeKey) {
      continue;
    }

    try {
      await archiveNotionPage(row.id, notionToken);
      archived += 1;
    } catch (error) {
      failed.push({
        vehicleId: sourceId || compositeKey || row.id,
        error: error instanceof Error ? error.message : 'Error desconocido al archivar vehiculo.'
      });
    }
  }

  return { failed, archived, deleteEnabled: true };
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
    status: item.status,
    publicationUrl: ''
  }));
}

export async function GET() {
  const stockDb = process.env.NOTION_STOCK_DATABASE_ID;
  const usersDb = process.env.NOTION_USERS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  try {
    const webVehicles = await fetchWebStock();

    if (!stockDb || !notionToken) {
      const cards = webVehicles.map((vehicle) => toCardFromWebVehicle(vehicle, undefined, new Map<string, string>()));

      return Response.json(
        { source: 'web', vehicles: cards },
        {
          headers: {
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    const [existingRows, userRows, schemaProperties] = await Promise.all([
      queryStockRows(stockDb),
      usersDb ? queryStockRows(usersDb) : Promise.resolve([] as NotionRow[]),
      getDatabaseSchema(stockDb, notionToken)
    ]);

    const syncResult = await syncWebStockToNotion(webVehicles, existingRows, schemaProperties, stockDb, notionToken);
    const syncedRows = await queryStockRows(stockDb);
    const userNameMap = buildUserNameMap(userRows);

    const sourceIdPropertyName = findPropertyName(schemaProperties, WEB_SOURCE_ID_CANDIDATES);
    const rowsBySourceId = new Map<string, NotionRow>();
    const rowsByCompositeKey = new Map<string, NotionRow>();

    syncedRows.forEach((row) => {
      if (sourceIdPropertyName) {
        const sourceId = getText(row.properties[sourceIdPropertyName]);
        if (sourceId) {
          rowsBySourceId.set(sourceId, row);
        }
      }

      const compositeKey = getNotionVehicleCompositeKey(row.properties);
      if (compositeKey) {
        rowsByCompositeKey.set(compositeKey, row);
      }
    });

    const cards = webVehicles.map((vehicle) => {
      const sourceId = String(vehicle.id || '').trim();
      const compositeKey = getWebVehicleCompositeKey(vehicle);
      const row = (sourceId && rowsBySourceId.get(sourceId)) || (compositeKey ? rowsByCompositeKey.get(compositeKey) : undefined);
      return toCardFromWebVehicle(vehicle, row, userNameMap);
    });

    return Response.json(
      {
        source: 'web',
        syncedWithNotion: true,
        deleteSyncedInNotion: syncResult.deleteEnabled,
        archivedInNotion: syncResult.archived,
        syncFailed: syncResult.failed,
        vehicles: cards
      },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('Error al consultar stock web.', error);

    return Response.json(
      {
        source: 'web',
        error: error instanceof Error ? error.message : 'Error desconocido al consultar el stock de ucars.cl.',
        vehicles: []
      },
      {
        status: 502,
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

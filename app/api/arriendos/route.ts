import { NOTION_VERSION, resolveDataSourceId, notionApiFetch } from '@/lib/notion-data-source';
import {
  AUTO_CANDIDATES,
  UCARIANO_CANDIDATES,
  START_DATE_CANDIDATES,
  END_DATE_CANDIDATES,
  TERM_CANDIDATES,
  DEADLINE_CANDIDATES,
  REMAINING_DAYS_CANDIDATES,
  ARRIENDO_EDITABLE_FIELDS,
  CONTRACT_NUMBER_CANDIDATES,
  COMMISSION_TERM_CANDIDATES,
  ARRIENDO_PRICE_CANDIDATES,
  ARRIENDO_PLATE_CANDIDATES,
  ARRIENDO_MILEAGE_CANDIDATES,
  ARRIENDO_UCARIANO_RUT_CANDIDATES,
  ARRIENDO_UCARIANO_ADDRESS_CANDIDATES,
  ARRIENDO_UCARIANO_COMMUNE_CANDIDATES,
  ARRIENDO_UCARIANO_PHONE_CANDIDATES,
  ARRIENDO_UCARIANO_EMAIL_CANDIDATES,
  STOCK_PLATE_CANDIDATES,
  STOCK_MILEAGE_CANDIDATES,
  STOCK_PRICE_CANDIDATES,
  UCARIANO_RUT_CANDIDATES,
  UCARIANO_EMAIL_CANDIDATES,
  UCARIANO_PHONE_CANDIDATES,
  UCARIANO_ADDRESS_CANDIDATES,
  UCARIANO_COMMUNE_CANDIDATES,
  fetchNotionPage,
  pickSchemaPropertyName,
  buildPropertyPayload,
  buildRelationPayload,
  todayIso,
  addDaysIso,
  ensureArriendoSchema,
  CONTRACT_PDF_CANDIDATES
} from '@/lib/arriendos';

// Resolver el nombre de auto/ucariano por relacion puede sumar varias llamadas a Notion.
export const maxDuration = 60;

type NotionProperty = Record<string, unknown> & {
  type?: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  number?: number | null;
  formula?: { string?: string | null; number?: number | null } | null;
  date?: { start?: string | null } | null;
  relation?: Array<{ id?: string }>;
  files?: Array<{ type?: 'external' | 'file'; external?: { url?: string }; file?: { url?: string } }>;
};

type NotionRow = {
  id: string;
  properties: Record<string, NotionProperty>;
};

type Arriendo = {
  id: string;
  auto: string;
  autoId: string | null;
  ucariano: string;
  ucarianoId: string | null;
  fechaInicio: string;
  fechaTermino: string;
  plazo: string;
  diasArriendoRestantes: number | null;
  numeroContrato: string;
  precioAutorizado: string;
  patente: string;
  kilometraje: string;
  plazoPagoComision: string;
  ucarianoRut: string;
  ucarianoDomicilio: string;
  ucarianoComuna: string;
  ucarianoTelefono: string;
  ucarianoEmail: string;
  contratoPdfUrl: string;
};

function getText(property?: NotionProperty | null) {
  if (!property) return '';
  if (Array.isArray(property.title)) return property.title.map((item) => item.plain_text || '').join('').trim();
  if (Array.isArray(property.rich_text)) return property.rich_text.map((item) => item.plain_text || '').join('').trim();
  if (property.formula?.string) return property.formula.string.trim();
  if (typeof property.formula?.number === 'number') return String(property.formula.number);
  if (property.date?.start) return property.date.start;
  if (typeof property.number === 'number') return String(property.number);
  return '';
}

function pickProperty(properties: Record<string, NotionProperty>, candidates: string[]) {
  const exact = candidates.map((candidate) => properties[candidate]).find(Boolean);
  if (exact) return exact;

  const normalizedCandidates = candidates.map(normalizeName);
  const key = Object.keys(properties).find((name) => normalizedCandidates.includes(normalizeName(name)));
  return key ? properties[key] : undefined;
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getRelationId(property?: NotionProperty | null) {
  return property?.relation?.[0]?.id || null;
}

function getDate(property?: NotionProperty | null) {
  return property?.date?.start || getText(property);
}

function getRemainingDays(endDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(endDate)) return null;
  const parts = endDate.slice(0, 10).split('-').map(Number);
  const endUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.ceil((endUtc - todayUtc) / 86400000));
}

function getNumber(property?: NotionProperty | null) {
  if (typeof property?.number === 'number') return property.number;
  if (typeof property?.formula?.number === 'number') return property.formula.number;

  const parsed = Number(getText(property).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function getFileUrl(property?: NotionProperty | null) {
  const file = property?.files?.[0];
  return file?.external?.url || file?.file?.url || '';
}

async function queryRows(databaseId: string, notionToken: string) {
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
      body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
      cache: 'no-store'
    });
    const payload = (await response.json()) as { results?: NotionRow[]; has_more?: boolean; next_cursor?: string | null; message?: string };
    if (!response.ok || !Array.isArray(payload.results)) {
      throw new Error(payload.message || 'No se pudo consultar Arriendos en Notion.');
    }
    rows.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor || undefined : undefined;
  } while (cursor);

  return rows;
}

async function getPage(pageId: string, notionToken: string) {
  const response = await notionApiFetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${notionToken}`, 'Notion-Version': NOTION_VERSION },
    cache: 'no-store'
  });
  const page = (await response.json()) as { properties?: Record<string, NotionProperty> };
  return response.ok && page.properties ? page.properties : {};
}

function getPageTitle(properties: Record<string, NotionProperty>, pageId: string) {
  const title = Object.values(properties).find((property) => property.type === 'title' && property.title?.length);
  return getText(title) || pageId;
}

async function resolveRelation(property: NotionProperty | undefined, notionToken: string) {
  const id = getRelationId(property);
  const properties = id ? await getPage(id, notionToken) : {};
  const name = id ? (getPageTitle(properties, id) || 'Sin asignar') : getText(property) || 'Sin asignar';
  return { id, name, properties };
}

type RelationInfo = { id: string | null; name: string; properties: Record<string, NotionProperty> };

function toArriendo(row: NotionRow, auto: RelationInfo, ucariano: RelationInfo): Arriendo {
  const properties = row.properties;
  const fechaInicio = getDate(pickProperty(properties, START_DATE_CANDIDATES));
  // Termino y Deadline son la misma fecha; se lee de la que exista en Notion.
  const fechaTermino = getDate(pickProperty(properties, END_DATE_CANDIDATES)) || getDate(pickProperty(properties, DEADLINE_CANDIDATES));
  const plazo = getText(pickProperty(properties, TERM_CANDIDATES));
  const remainingDaysFromNotion = getNumber(pickProperty(properties, REMAINING_DAYS_CANDIDATES));

  return {
    id: row.id,
    auto: auto.name,
    autoId: auto.id,
    ucariano: ucariano.name,
    ucarianoId: ucariano.id,
    fechaInicio,
    fechaTermino,
    plazo,
    diasArriendoRestantes: remainingDaysFromNotion ?? getRemainingDays(fechaTermino),
    numeroContrato: getText(pickProperty(properties, CONTRACT_NUMBER_CANDIDATES)),
    // Datos del vehiculo y del ucariano: se autocompletan desde Stock/Ucarianos, pero el valor guardado en
    // el Arriendo (si el operador lo edito) tiene prioridad.
    precioAutorizado: getText(pickProperty(properties, ARRIENDO_PRICE_CANDIDATES)) || getText(pickProperty(auto.properties, STOCK_PRICE_CANDIDATES)),
    patente: getText(pickProperty(properties, ARRIENDO_PLATE_CANDIDATES)) || getText(pickProperty(auto.properties, STOCK_PLATE_CANDIDATES)),
    kilometraje: getText(pickProperty(properties, ARRIENDO_MILEAGE_CANDIDATES)) || getText(pickProperty(auto.properties, STOCK_MILEAGE_CANDIDATES)),
    plazoPagoComision: getText(pickProperty(properties, COMMISSION_TERM_CANDIDATES)),
    ucarianoRut: getText(pickProperty(properties, ARRIENDO_UCARIANO_RUT_CANDIDATES)) || getText(pickProperty(ucariano.properties, UCARIANO_RUT_CANDIDATES)),
    ucarianoDomicilio: getText(pickProperty(properties, ARRIENDO_UCARIANO_ADDRESS_CANDIDATES)) || getText(pickProperty(ucariano.properties, UCARIANO_ADDRESS_CANDIDATES)),
    ucarianoComuna: getText(pickProperty(properties, ARRIENDO_UCARIANO_COMMUNE_CANDIDATES)) || getText(pickProperty(ucariano.properties, UCARIANO_COMMUNE_CANDIDATES)),
    ucarianoTelefono: getText(pickProperty(properties, ARRIENDO_UCARIANO_PHONE_CANDIDATES)) || getText(pickProperty(ucariano.properties, UCARIANO_PHONE_CANDIDATES)),
    ucarianoEmail: getText(pickProperty(properties, ARRIENDO_UCARIANO_EMAIL_CANDIDATES)) || getText(pickProperty(ucariano.properties, UCARIANO_EMAIL_CANDIDATES)),
    contratoPdfUrl: getFileUrl(pickProperty(properties, CONTRACT_PDF_CANDIDATES))
  };
}

export async function GET() {
  const databaseId = process.env.NOTION_ARRIENDOS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!databaseId || !notionToken) {
    return Response.json({ source: 'notion', arriendos: [], error: 'Faltan NOTION_API_KEY o NOTION_ARRIENDOS_DATABASE_ID.' }, { status: 503 });
  }

  try {
    const rows = await queryRows(databaseId, notionToken);
    const arriendos = await Promise.all(rows.map(async (row) => {
      const auto = await resolveRelation(pickProperty(row.properties, AUTO_CANDIDATES), notionToken);
      const ucariano = await resolveRelation(pickProperty(row.properties, UCARIANO_CANDIDATES), notionToken);
      return toArriendo(row, auto, ucariano);
    }));

    return Response.json({ source: 'notion', arriendos }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al consultar Arriendos en Notion.', error);
    return Response.json({ source: 'notion', arriendos: [], error: error instanceof Error ? error.message : 'Error desconocido al consultar Arriendos.' }, { status: 502 });
  }
}

// Se crea un nuevo arriendo/contrato cada vez que se asigna un ucariano a un vehiculo desde Stock.
export async function POST(request: Request) {
  const databaseId = process.env.NOTION_ARRIENDOS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!databaseId || !notionToken) {
    return Response.json({ error: 'Faltan NOTION_API_KEY o NOTION_ARRIENDOS_DATABASE_ID.' }, { status: 503 });
  }

  let body: { vehicleId?: string; vehicleName?: string; ucarianoId?: string; ucarianoName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud invalido.' }, { status: 400 });
  }

  const vehicleId = body.vehicleId?.trim();
  const vehicleName = body.vehicleName?.trim() || 'Vehiculo';
  const ucarianoId = body.ucarianoId?.trim();
  const ucarianoName = body.ucarianoName?.trim() || 'Ucariano';

  if (!vehicleId || !ucarianoId) {
    return Response.json({ error: 'Faltan vehicleId o ucarianoId.' }, { status: 400 });
  }

  try {
    const [schema, dataSourceId, existingRows, autoProps, ucarianoProps] = await Promise.all([
      ensureArriendoSchema(databaseId, notionToken),
      resolveDataSourceId(databaseId, notionToken),
      queryRows(databaseId, notionToken),
      fetchNotionPage(vehicleId, notionToken).catch(() => ({})),
      fetchNotionPage(ucarianoId, notionToken).catch(() => ({}))
    ]);

    const fechaInicio = todayIso();
    const plazoDias = 45;
    const fechaTermino = addDaysIso(fechaInicio, plazoDias);

    const properties: Record<string, unknown> = {};

    const titlePropertyName = Object.keys(schema).find((key) => schema[key]?.type === 'title');
    if (titlePropertyName) {
      properties[titlePropertyName] = buildPropertyPayload('title', `${vehicleName} - ${ucarianoName}`);
    }

    const autoPropertyName = pickSchemaPropertyName(schema, AUTO_CANDIDATES);
    if (autoPropertyName && schema[autoPropertyName]?.type === 'relation') {
      properties[autoPropertyName] = buildRelationPayload(vehicleId);
    }

    const ucarianoPropertyName = pickSchemaPropertyName(schema, UCARIANO_CANDIDATES);
    if (ucarianoPropertyName && schema[ucarianoPropertyName]?.type === 'relation') {
      properties[ucarianoPropertyName] = buildRelationPayload(ucarianoId);
    }

    const setTextField = (candidates: string[], value: string) => {
      if (!value) return;
      const name = pickSchemaPropertyName(schema, candidates);
      if (!name) return;
      const payload = buildPropertyPayload(schema[name]?.type, value);
      if (payload) properties[name] = payload;
    };

    setTextField(START_DATE_CANDIDATES, fechaInicio);
    setTextField(END_DATE_CANDIDATES, fechaTermino);
    setTextField(TERM_CANDIDATES, String(plazoDias));
    setTextField(DEADLINE_CANDIDATES, fechaTermino);
    setTextField(CONTRACT_NUMBER_CANDIDATES, String(existingRows.length + 1));
    setTextField(COMMISSION_TERM_CANDIDATES, '5');
    // Valores iniciales autocompletados desde Stock/Ucarianos; el operador puede editarlos despues via PATCH.
    setTextField(ARRIENDO_PRICE_CANDIDATES, getText(pickProperty(autoProps, STOCK_PRICE_CANDIDATES)));
    setTextField(ARRIENDO_PLATE_CANDIDATES, getText(pickProperty(autoProps, STOCK_PLATE_CANDIDATES)));
    setTextField(ARRIENDO_MILEAGE_CANDIDATES, getText(pickProperty(autoProps, STOCK_MILEAGE_CANDIDATES)));
    setTextField(ARRIENDO_UCARIANO_RUT_CANDIDATES, getText(pickProperty(ucarianoProps, UCARIANO_RUT_CANDIDATES)));
    setTextField(ARRIENDO_UCARIANO_ADDRESS_CANDIDATES, getText(pickProperty(ucarianoProps, UCARIANO_ADDRESS_CANDIDATES)));
    setTextField(ARRIENDO_UCARIANO_COMMUNE_CANDIDATES, getText(pickProperty(ucarianoProps, UCARIANO_COMMUNE_CANDIDATES)));
    setTextField(ARRIENDO_UCARIANO_PHONE_CANDIDATES, getText(pickProperty(ucarianoProps, UCARIANO_PHONE_CANDIDATES)));
    setTextField(ARRIENDO_UCARIANO_EMAIL_CANDIDATES, getText(pickProperty(ucarianoProps, UCARIANO_EMAIL_CANDIDATES)));

    const createResponse = await notionApiFetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ parent: { data_source_id: dataSourceId }, properties })
    });

    const createPayload = (await createResponse.json()) as { id?: string; message?: string };
    if (!createResponse.ok || !createPayload.id) {
      throw new Error(createPayload.message || 'No se pudo crear el arriendo/contrato en Notion.');
    }

    return Response.json(
      { id: createPayload.id, fechaInicio, fechaTermino, plazo: String(plazoDias) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al crear el arriendo en Notion.', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al crear el arriendo.' },
      { status: 500 }
    );
  }
}

// Edita las propiedades del contrato de arriendo (todas las que aparecen en la ficha del vehiculo son editables).
export async function PATCH(request: Request) {
  const databaseId = process.env.NOTION_ARRIENDOS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!databaseId || !notionToken) {
    return Response.json({ error: 'Faltan NOTION_API_KEY o NOTION_ARRIENDOS_DATABASE_ID.' }, { status: 503 });
  }

  let body: { id?: string } & Record<string, string | undefined>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud invalido.' }, { status: 400 });
  }

  const arriendoId = body.id?.trim();
  if (!arriendoId) {
    return Response.json({ error: 'Falta el identificador del arriendo.' }, { status: 400 });
  }

  try {
    const schema = await ensureArriendoSchema(databaseId, notionToken);
    const properties: Record<string, unknown> = {};
    // Campos que el operador pidio guardar pero que no tienen una columna equivalente en Notion:
    // se reportan al cliente para que no crea que quedaron guardados cuando en realidad se ignoraron.
    const missingFields: string[] = [];

    for (const [field, candidates] of Object.entries(ARRIENDO_EDITABLE_FIELDS)) {
      const value = body[field];
      if (value === undefined) continue;

      const propertyName = pickSchemaPropertyName(schema, candidates);
      if (!propertyName) {
        missingFields.push(field);
        continue;
      }

      const payload = buildPropertyPayload(schema[propertyName]?.type, value);
      if (payload) properties[propertyName] = payload;
    }

    // fechaTermino se calcula automaticamente (fechaInicio + plazo); Termino y Deadline son la misma fecha,
    // asi que se escribe en ambas columnas de Notion si existen.
    if (body.fechaInicio !== undefined || body.plazo !== undefined) {
      const arriendoProps = await fetchNotionPage(arriendoId, notionToken).catch(() => ({}));
      const fechaInicioValue = body.fechaInicio !== undefined ? body.fechaInicio : getDate(pickProperty(arriendoProps, START_DATE_CANDIDATES));
      const plazoValue = body.plazo !== undefined ? body.plazo : getText(pickProperty(arriendoProps, TERM_CANDIDATES));

      if (fechaInicioValue && plazoValue) {
        const computedFechaTermino = addDaysIso(fechaInicioValue, Number(plazoValue) || 0);

        const endName = pickSchemaPropertyName(schema, END_DATE_CANDIDATES);
        if (endName) {
          const payload = buildPropertyPayload(schema[endName]?.type, computedFechaTermino);
          if (payload) properties[endName] = payload;
        }

        const deadlineName = pickSchemaPropertyName(schema, DEADLINE_CANDIDATES);
        if (deadlineName && deadlineName !== endName) {
          const payload = buildPropertyPayload(schema[deadlineName]?.type, computedFechaTermino);
          if (payload) properties[deadlineName] = payload;
        }
      }
    }

    if (Object.keys(properties).length === 0) {
      return Response.json(
        { error: 'Ningun campo enviado coincide con propiedades existentes en Notion.', missingFields },
        { status: 422 }
      );
    }

    const updateResponse = await notionApiFetch(`https://api.notion.com/v1/pages/${arriendoId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    const updatePayload = (await updateResponse.json()) as { message?: string };
    if (!updateResponse.ok) {
      throw new Error(updatePayload.message || 'No se pudo actualizar el contrato en Notion.');
    }

    return Response.json({ id: arriendoId, updated: true, missingFields }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al editar el arriendo en Notion.', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al editar el arriendo.' },
      { status: 500 }
    );
  }
}

import { NOTION_VERSION, notionApiFetch } from '@/lib/notion-data-source';

// Helpers compartidos entre app/api/arriendos/route.ts (listar/crear/editar arriendos en Notion)
// y app/api/arriendos/contrato/route.ts (armar el contrato PDF/HTML desde la plantilla).

export type NotionProperty = Record<string, unknown> & {
  type?: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  number?: number | null;
  select?: { name?: string };
  status?: { name?: string };
  formula?: { string?: string | null; number?: number | null } | null;
  date?: { start?: string | null } | null;
  relation?: Array<{ id?: string }>;
  url?: string | null;
};

export type NotionSchemaProperty = { type?: string };

export const AUTO_CANDIDATES = ['Auto', 'Vehículo', 'Vehiculo', 'Vehicle', 'Auto de interés', 'Auto de interes'];
export const UCARIANO_CANDIDATES = ['Ucariano', 'Ucariano Asignado', 'Asesor', 'Advisor', 'Ejecutivo'];
export const START_DATE_CANDIDATES = ['Fecha de inicio', 'Inicio', 'Fecha Inicio', 'Start Date'];
export const END_DATE_CANDIDATES = ['Fecha de término', 'Fecha de termino', 'Término', 'Termino', 'Fecha fin', 'Fin', 'End Date'];
export const TERM_CANDIDATES = ['Plazo', 'Termino', 'Término', 'Duración', 'Duracion', 'Term'];
export const DEADLINE_CANDIDATES = ['Deadline', 'Fecha Deadline', 'Vencimiento', 'Fecha de vencimiento'];
export const REMAINING_DAYS_CANDIDATES = ['Días restantes', 'Dias restantes', 'Días de arriendo restantes', 'Dias de arriendo restantes', 'Remaining Days'];

export const CONTRACT_NUMBER_CANDIDATES = ['N° Contrato', 'Numero de Contrato', 'Número de Contrato', 'Contrato N°', 'Contract Number'];
export const COMMISSION_TERM_CANDIDATES = ['Plazo pago comisión', 'Plazo pago comision', 'Plazo de pago de comisión'];
export const ARRIENDO_PRICE_CANDIDATES = ['Precio autorizado', 'Precio de venta autorizado', 'Precio Autorizado'];
export const ARRIENDO_PLATE_CANDIDATES = ['Patente'];
export const ARRIENDO_MILEAGE_CANDIDATES = ['Kilometraje', 'Kilometraje a la entrega'];
export const ARRIENDO_UCARIANO_RUT_CANDIDATES = ['RUT Ucariano', 'RUT'];
export const ARRIENDO_UCARIANO_ADDRESS_CANDIDATES = ['Domicilio Ucariano', 'Domicilio'];
export const ARRIENDO_UCARIANO_COMMUNE_CANDIDATES = ['Comuna Ucariano', 'Comuna'];
export const ARRIENDO_UCARIANO_PHONE_CANDIDATES = ['Teléfono Ucariano', 'Telefono Ucariano'];
export const ARRIENDO_UCARIANO_EMAIL_CANDIDATES = ['Email Ucariano'];

export const STOCK_PLATE_CANDIDATES = ['Patente', 'Placa patente', 'Placa'];
export const STOCK_MILEAGE_CANDIDATES = ['Kilometraje', 'KM', 'Odómetro', 'Odometro'];
export const STOCK_PRICE_CANDIDATES = ['Precio', 'Precio de venta', 'Price'];

export const UCARIANO_NAME_CANDIDATES = ['Nombre', 'Name', 'Ucariano'];
export const UCARIANO_RUT_CANDIDATES = ['RUT', 'Rut', 'RUN', 'Run', 'Documento'];
export const UCARIANO_EMAIL_CANDIDATES = ['Email', 'Correo', 'Mail'];
export const UCARIANO_PHONE_CANDIDATES = ['Teléfono', 'Telefono', 'Phone', 'Celular'];
export const UCARIANO_ADDRESS_CANDIDATES = ['Domicilio', 'Dirección', 'Direccion', 'Address'];
export const UCARIANO_COMMUNE_CANDIDATES = ['Comuna', 'Commune'];

// Campos editables del contrato de arriendo: fechas/plazo, mas los datos del ucariano y del vehiculo que se
// autocompletan desde Notion (Stock/Ucarianos) pero el operador puede sobrescribir para este contrato en particular.
export const ARRIENDO_EDITABLE_FIELDS: Record<string, string[]> = {
  fechaInicio: START_DATE_CANDIDATES,
  fechaTermino: END_DATE_CANDIDATES,
  plazo: TERM_CANDIDATES,
  deadline: DEADLINE_CANDIDATES,
  numeroContrato: CONTRACT_NUMBER_CANDIDATES,
  plazoPagoComision: COMMISSION_TERM_CANDIDATES,
  precioAutorizado: ARRIENDO_PRICE_CANDIDATES,
  patente: ARRIENDO_PLATE_CANDIDATES,
  kilometraje: ARRIENDO_MILEAGE_CANDIDATES,
  ucarianoRut: ARRIENDO_UCARIANO_RUT_CANDIDATES,
  ucarianoDomicilio: ARRIENDO_UCARIANO_ADDRESS_CANDIDATES,
  ucarianoComuna: ARRIENDO_UCARIANO_COMMUNE_CANDIDATES,
  ucarianoTelefono: ARRIENDO_UCARIANO_PHONE_CANDIDATES,
  ucarianoEmail: ARRIENDO_UCARIANO_EMAIL_CANDIDATES
};

export function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function pickProperty(properties: Record<string, NotionProperty>, candidates: string[]) {
  const exact = candidates.map((candidate) => properties[candidate]).find(Boolean);
  if (exact) return exact;

  const normalizedCandidates = candidates.map(normalizeName);
  const key = Object.keys(properties).find((name) => normalizedCandidates.includes(normalizeName(name)));
  return key ? properties[key] : undefined;
}

export function pickSchemaPropertyName(schema: Record<string, NotionSchemaProperty>, candidates: string[]) {
  const exact = candidates.find((candidate) => Boolean(schema[candidate]));
  if (exact) return exact;

  const normalizedCandidates = candidates.map(normalizeName);
  return Object.keys(schema).find((name) => normalizedCandidates.includes(normalizeName(name)));
}

export function getText(property?: NotionProperty | null) {
  if (!property) return '';
  if (Array.isArray(property.title)) return property.title.map((item) => item.plain_text || '').join('').trim();
  if (Array.isArray(property.rich_text)) return property.rich_text.map((item) => item.plain_text || '').join('').trim();
  if (property.select?.name) return property.select.name;
  if (property.status?.name) return property.status.name;
  if (property.formula?.string) return property.formula.string.trim();
  if (typeof property.formula?.number === 'number') return String(property.formula.number);
  if (property.date?.start) return property.date.start;
  if (typeof property.number === 'number') return String(property.number);
  if (typeof property.url === 'string') return property.url;
  return '';
}

export function getNumber(property?: NotionProperty | null) {
  if (typeof property?.number === 'number') return property.number;
  if (typeof property?.formula?.number === 'number') return property.formula.number;
  const parsed = Number(getText(property).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function getRelationId(property?: NotionProperty | null) {
  return property?.relation?.[0]?.id || null;
}

/** Arma el payload de escritura de una propiedad de Notion segun su tipo real detectado en el esquema. */
export function buildPropertyPayload(type: string | undefined, value: string): Record<string, unknown> | null {
  switch (type) {
    case 'title':
      return { title: value ? [{ type: 'text', text: { content: value } }] : [] };
    case 'rich_text':
      return { rich_text: value ? [{ type: 'text', text: { content: value } }] : [] };
    case 'number': {
      const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
      return { number: Number.isFinite(parsed) && value !== '' ? parsed : null };
    }
    case 'url':
      return { url: value || null };
    case 'select':
      return { select: value ? { name: value } : null };
    case 'date':
      return { date: value ? { start: value } : null };
    default:
      return null;
  }
}

export function buildRelationPayload(id: string | null) {
  return { relation: id ? [{ id }] : [] };
}

export async function fetchNotionPage(pageId: string, notionToken: string) {
  const response = await notionApiFetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${notionToken}`, 'Notion-Version': NOTION_VERSION },
    cache: 'no-store'
  });
  const page = (await response.json()) as { properties?: Record<string, NotionProperty>; message?: string };
  if (!response.ok || !page.properties) {
    throw new Error(page.message || `No se pudo leer la pagina ${pageId} en Notion.`);
  }
  return page.properties;
}

export function getPageTitleText(properties: Record<string, NotionProperty>) {
  const titleProperty = Object.values(properties).find((property) => property.type === 'title' && property.title?.length);
  return getText(titleProperty);
}

export function clp(amount: number) {
  return '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function formatLongDateEs(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : new Date();
  return `${date.getUTCDate()} de ${MONTHS_ES[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(dateStr: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  const base = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export type ArriendoContractDetail = {
  id: string;
  autoId: string | null;
  autoName: string;
  ucarianoId: string | null;
  ucarianoName: string;
  numeroContrato: string;
  fechaInicio: string;
  precioAutorizado: number;
  patente: string;
  kilometraje: string;
  plazoPagoComision: string;
  ucarianoRut: string;
  ucarianoDomicilio: string;
  ucarianoComuna: string;
  ucarianoTelefono: string;
  ucarianoEmail: string;
};

/** Junta los datos del contrato: la pagina de Arriendo, la del Auto (Stock) y la del Ucariano relacionados. */
export async function fetchArriendoContractDetail(arriendoId: string, notionToken: string): Promise<ArriendoContractDetail> {
  const arriendoProps = await fetchNotionPage(arriendoId, notionToken);

  const autoId = getRelationId(pickProperty(arriendoProps, AUTO_CANDIDATES));
  const ucarianoId = getRelationId(pickProperty(arriendoProps, UCARIANO_CANDIDATES));

  const [autoProps, ucarianoProps] = await Promise.all([
    autoId ? fetchNotionPage(autoId, notionToken) : Promise.resolve<Record<string, NotionProperty>>({}),
    ucarianoId ? fetchNotionPage(ucarianoId, notionToken) : Promise.resolve<Record<string, NotionProperty>>({})
  ]);

  const autoName = getPageTitleText(autoProps) || getText(pickProperty(arriendoProps, AUTO_CANDIDATES)) || 'Vehiculo sin nombre';
  const ucarianoName =
    getText(pickProperty(ucarianoProps, UCARIANO_NAME_CANDIDATES)) ||
    getPageTitleText(ucarianoProps) ||
    getText(pickProperty(arriendoProps, UCARIANO_CANDIDATES)) ||
    'Sin asignar';

  const fechaInicio = getText(pickProperty(arriendoProps, START_DATE_CANDIDATES)) || todayIso();

  // Datos del vehiculo y del ucariano: se autocompletan desde Stock/Ucarianos, pero el operador puede
  // sobrescribirlos para este contrato (el valor guardado en el Arriendo tiene prioridad si existe).
  const precioAutorizado =
    getNumber(pickProperty(arriendoProps, ARRIENDO_PRICE_CANDIDATES)) ??
    getNumber(pickProperty(autoProps, STOCK_PRICE_CANDIDATES)) ??
    0;

  const patente =
    getText(pickProperty(arriendoProps, ARRIENDO_PLATE_CANDIDATES)) ||
    getText(pickProperty(autoProps, STOCK_PLATE_CANDIDATES));

  const kilometraje =
    getText(pickProperty(arriendoProps, ARRIENDO_MILEAGE_CANDIDATES)) ||
    getText(pickProperty(autoProps, STOCK_MILEAGE_CANDIDATES));

  const plazoPagoComision = getText(pickProperty(arriendoProps, COMMISSION_TERM_CANDIDATES)) || '5';

  const ucarianoRut =
    getText(pickProperty(arriendoProps, ARRIENDO_UCARIANO_RUT_CANDIDATES)) ||
    getText(pickProperty(ucarianoProps, UCARIANO_RUT_CANDIDATES));

  const ucarianoDomicilio =
    getText(pickProperty(arriendoProps, ARRIENDO_UCARIANO_ADDRESS_CANDIDATES)) ||
    getText(pickProperty(ucarianoProps, UCARIANO_ADDRESS_CANDIDATES));

  const ucarianoComuna =
    getText(pickProperty(arriendoProps, ARRIENDO_UCARIANO_COMMUNE_CANDIDATES)) ||
    getText(pickProperty(ucarianoProps, UCARIANO_COMMUNE_CANDIDATES));

  const ucarianoTelefono =
    getText(pickProperty(arriendoProps, ARRIENDO_UCARIANO_PHONE_CANDIDATES)) ||
    getText(pickProperty(ucarianoProps, UCARIANO_PHONE_CANDIDATES));

  const ucarianoEmail =
    getText(pickProperty(arriendoProps, ARRIENDO_UCARIANO_EMAIL_CANDIDATES)) ||
    getText(pickProperty(ucarianoProps, UCARIANO_EMAIL_CANDIDATES));

  const numeroContrato = getText(pickProperty(arriendoProps, CONTRACT_NUMBER_CANDIDATES)) || arriendoId.replace(/-/g, '').slice(-6).toUpperCase();

  return {
    id: arriendoId,
    autoId,
    autoName,
    ucarianoId,
    ucarianoName,
    numeroContrato,
    fechaInicio,
    precioAutorizado,
    patente,
    kilometraje,
    plazoPagoComision,
    ucarianoRut,
    ucarianoDomicilio,
    ucarianoComuna,
    ucarianoTelefono,
    ucarianoEmail
  };
}

/** Traduce el detalle del contrato a las variables {{VARIABLE}} que espera la plantilla HTML. */
export function buildTemplateValues(detail: ArriendoContractDetail): Record<string, string> {
  const price = detail.precioAutorizado || 0;

  return {
    NUMERO_CONTRATO: detail.numeroContrato,
    FECHA_LARGA: formatLongDateEs(detail.fechaInicio),
    UCARIANO_NOMBRE: detail.ucarianoName,
    UCARIANO_RUT: detail.ucarianoRut || 'No registrado',
    UCARIANO_DOMICILIO: detail.ucarianoDomicilio || 'No registrado',
    UCARIANO_COMUNA: detail.ucarianoComuna || 'No registrado',
    UCARIANO_TELEFONO: detail.ucarianoTelefono || 'No registrado',
    UCARIANO_EMAIL: detail.ucarianoEmail || 'No registrado',
    VEHICULO: detail.autoName,
    PATENTE: detail.patente || 'No registrada',
    KILOMETRAJE: detail.kilometraje ? `${detail.kilometraje} km` : 'No registrado',
    PRECIO_AUTORIZADO: clp(price),
    PLAZO_PAGO_COMISION: detail.plazoPagoComision || '5',
    COMISION: clp(price * 0.03),
    TARIFA_TURBO: clp(price * 0.0002),
    TARIFA_LENTO: clp(price * 0.0005),
    TARIFA_CARO: clp(price * 0.0008),
    TARIFA_CRITICO: clp(price * 0.0014)
  };
}

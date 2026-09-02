// Notion API 2025-09-03 requires a data source id (not the database id) to query/create
// pages once a database has more than one data source; older versions reject those calls
// with "Databases with multiple data sources are not supported in this API version."
export const NOTION_VERSION = '2025-09-03';

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Notion's API allows ~3 requests/second per integration; a fixed gap between calls keeps
// sequential loops (e.g. syncing hundreds of Sheet rows) from tripping "rate limited" errors.
let lastNotionCallAt = 0;
const MIN_GAP_MS = 350;

async function throttleNotionCall() {
  const wait = lastNotionCallAt + MIN_GAP_MS - Date.now();
  if (wait > 0) {
    await sleep(wait);
  }
  lastNotionCallAt = Date.now();
}

/** fetch() wrapper for the Notion API that throttles calls and retries on 429 (rate limited). */
export async function notionApiFetch(url: string, init?: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await throttleNotionCall();
    const response = await fetch(url, init);

    if (response.status !== 429 || attempt === maxRetries) {
      return response;
    }

    const retryAfterHeader = Number(response.headers.get('Retry-After'));
    const backoffMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : 1000 * (attempt + 1);
    await sleep(backoffMs);
  }

  // Unreachable, but keeps TypeScript happy about the return type.
  return fetch(url, init);
}

const dataSourceCache = new Map<string, Promise<string>>();

export async function resolveDataSourceId(databaseId: string, notionToken: string): Promise<string> {
  const cached = dataSourceCache.get(databaseId);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const response = await notionApiFetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': NOTION_VERSION
      },
      cache: 'no-store'
    });

    const payload = (await response.json()) as {
      data_sources?: Array<{ id?: string; name?: string }>;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(payload.message || `No se pudo resolver el data source de la base ${databaseId} en Notion.`);
    }

    const dataSourceId = payload.data_sources?.[0]?.id;
    if (!dataSourceId) {
      throw new Error(`La base ${databaseId} en Notion no tiene un data source disponible.`);
    }

    return dataSourceId;
  })();

  dataSourceCache.set(databaseId, promise);
  promise.catch(() => dataSourceCache.delete(databaseId));

  return promise;
}

export type NotionSchemaProperty = {
  type?: string;
  select?: { options?: Array<{ name?: string }> };
  status?: { options?: Array<{ name?: string }> };
  multi_select?: { options?: Array<{ name?: string }> };
};

/** Retrieves a data source's full property schema (types + select/status/multi_select options). */
export async function getDataSourceSchema(
  databaseId: string,
  notionToken: string
): Promise<Record<string, NotionSchemaProperty>> {
  const dataSourceId = await resolveDataSourceId(databaseId, notionToken);

  const response = await notionApiFetch(`https://api.notion.com/v1/data_sources/${dataSourceId}`, {
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': NOTION_VERSION
    },
    cache: 'no-store'
  });

  const payload = (await response.json()) as {
    properties?: Record<string, NotionSchemaProperty>;
    message?: string;
  };

  if (!response.ok || !payload.properties) {
    throw new Error(payload.message || 'No se pudo leer el esquema en Notion.');
  }

  return payload.properties;
}

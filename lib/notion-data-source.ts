// Notion API 2025-09-03 requires a data source id (not the database id) to query/create
// pages once a database has more than one data source; older versions reject those calls
// with "Databases with multiple data sources are not supported in this API version."
export const NOTION_VERSION = '2025-09-03';

const dataSourceCache = new Map<string, Promise<string>>();

export async function resolveDataSourceId(databaseId: string, notionToken: string): Promise<string> {
  const cached = dataSourceCache.get(databaseId);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
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

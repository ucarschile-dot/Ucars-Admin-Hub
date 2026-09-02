import { resolveDataSourceId, notionApiFetch, NOTION_VERSION } from '@/lib/notion-data-source';

type NotionRow = { id: string };

// Deja correr esta ruta mas tiempo: archivar cientos de paginas una por una toma varios segundos.
export const maxDuration = 60;

async function queryPageIds(dataSourceId: string, token: string) {
  const rows: NotionRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionApiFetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ start_cursor: cursor, page_size: 100 })
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

// Archiva (elimina) TODAS las paginas de la base de Ucarianos en Notion, en porciones para no
// exceder el tiempo maximo de una funcion serverless; el llamador debe repetir la llamada con
// el nextOffset devuelto hasta que done=true.
export async function POST(request: Request) {
  const databaseId = process.env.NOTION_USERS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!databaseId || !notionToken) {
    return Response.json({ error: 'Notion no esta configurado en esta app.' }, { status: 503 });
  }

  let body: { offset?: number; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    // Cuerpo vacio es valido: se usan los valores por defecto (desde el inicio).
  }

  const offset = Number.isFinite(body.offset) && (body.offset as number) >= 0 ? (body.offset as number) : 0;
  const limit = Number.isFinite(body.limit) && (body.limit as number) > 0 ? (body.limit as number) : 50;

  const result = { archived: 0, errors: [] as string[], total: 0, processed: 0, nextOffset: null as number | null, done: true };

  try {
    const dataSourceId = await resolveDataSourceId(databaseId, notionToken);
    const rows = await queryPageIds(dataSourceId, notionToken);
    result.total = rows.length;

    const chunk = rows.slice(offset, offset + limit);
    result.processed = chunk.length;
    const isLastChunk = offset + limit >= rows.length;
    result.nextOffset = isLastChunk ? null : offset + limit;
    result.done = isLastChunk;

    for (const row of chunk) {
      try {
        const response = await notionApiFetch(`https://api.notion.com/v1/pages/${row.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${notionToken}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ archived: true })
        });

        const payload = (await response.json()) as { message?: string };
        if (!response.ok) {
          throw new Error(payload.message || `No se pudo archivar la pagina ${row.id}.`);
        }

        result.archived += 1;
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : `No se pudo archivar la pagina ${row.id}.`);
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Error desconocido al eliminar Ucarianos en Notion.');
  }

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

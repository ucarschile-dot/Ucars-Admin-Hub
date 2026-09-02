import { getDataSourceSchema } from '@/lib/notion-data-source';

const EDITABLE_TYPES = new Set([
  'title',
  'rich_text',
  'email',
  'phone_number',
  'url',
  'number',
  'checkbox',
  'select',
  'status',
  'multi_select',
  'date'
]);

// Expone el esquema editable del Ucariano activo en Notion para armar un formulario dinamico.
export async function GET() {
  const databaseId = process.env.NOTION_USERS_DATABASE_ID;
  const notionToken = process.env.NOTION_API_KEY;

  if (!databaseId || !notionToken) {
    return Response.json({ error: 'Notion no esta configurado en esta app.' }, { status: 503 });
  }

  try {
    const schema = await getDataSourceSchema(databaseId, notionToken);

    const properties = Object.entries(schema)
      .filter(([, property]) => EDITABLE_TYPES.has(property.type || ''))
      .map(([name, property]) => ({
        name,
        type: property.type,
        options:
          property.select?.options?.map((option) => option.name).filter(Boolean) ||
          property.status?.options?.map((option) => option.name).filter(Boolean) ||
          property.multi_select?.options?.map((option) => option.name).filter(Boolean) ||
          undefined
      }));

    return Response.json({ properties }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al leer el esquema de Ucarianos en Notion.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al leer el esquema en Notion.' },
      { status: 502 }
    );
  }
}

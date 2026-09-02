import { hasUcarianosSheetSyncConfig, syncUcarianosSheetToNotion } from '@/lib/ucarianos-sync';

// Endpoint aislado para probar la sincronizacion Sheet -> Notion desde la pestana de Pruebas,
// sin depender de que /api/ucarianos (usado por la pagina en vivo) dispare la sync.
export async function POST() {
  if (!hasUcarianosSheetSyncConfig()) {
    return Response.json(
      {
        error:
          'Faltan variables de entorno para la sincronizacion: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SHEET_UCARIANOS_DB_ID, NOTION_API_KEY o NOTION_USERS_DATABASE_ID.'
      },
      { status: 503 }
    );
  }

  const result = await syncUcarianosSheetToNotion();

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

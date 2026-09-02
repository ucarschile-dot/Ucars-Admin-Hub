import { hasUcarianosSheetSyncConfig, syncUcarianosSheetToNotion } from '@/lib/ucarianos-sync';

// Deja correr esta ruta mas tiempo (limite real depende del plan de Vercel): sincronizar
// paginas de Notion una por una para cientos de filas del Sheet toma varios segundos.
export const maxDuration = 60;

// Endpoint aislado para probar la sincronizacion Sheet -> Notion desde la pestana de Pruebas,
// sin depender de que /api/ucarianos (usado por la pagina en vivo) dispare la sync.
// Procesa en porciones (offset/limit) para no exceder el tiempo maximo de una funcion serverless;
// el llamador debe repetir la llamada con el nextOffset devuelto hasta que done=true.
export async function POST(request: Request) {
  if (!hasUcarianosSheetSyncConfig()) {
    return Response.json(
      {
        error:
          'Faltan variables de entorno para la sincronizacion: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SHEET_UCARIANOS_DB_ID, NOTION_API_KEY o NOTION_USERS_DATABASE_ID.'
      },
      { status: 503 }
    );
  }

  let body: { offset?: number; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    // Cuerpo vacio es valido: se usan los valores por defecto (desde el inicio).
  }

  const offset = Number.isFinite(body.offset) && (body.offset as number) >= 0 ? (body.offset as number) : 0;
  const limit = Number.isFinite(body.limit) && (body.limit as number) > 0 ? (body.limit as number) : 100;

  const result = await syncUcarianosSheetToNotion(offset, limit);

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

import { hasGoogleSheetsConfig, fetchSheetOrExcelValues, rowsToObjects } from '@/lib/google-sheets';

// Lee el Google Sheet dedicado que sera la fuente principal de Ucarianos (distinto de GOOGLE_SHEET_ID).
export async function GET(request: Request) {
  const spreadsheetId = process.env.GOOGLE_SHEET_UCARIANOS_DB_ID;
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range')?.trim() || process.env.GOOGLE_SHEET_UCARIANOS_DB_RANGE || 'Ucarianos';

  if (!hasGoogleSheetsConfig() || !spreadsheetId) {
    return Response.json(
      {
        error:
          'El Sheet dedicado de Ucarianos no esta configurado. Revisa GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY y GOOGLE_SHEET_UCARIANOS_DB_ID.'
      },
      { status: 503 }
    );
  }

  try {
    const rawRows = await fetchSheetOrExcelValues(spreadsheetId, range);
    const rows = rowsToObjects(rawRows);

    return Response.json(
      { source: 'google-sheets', range, rows, rawRows },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al consultar el Sheet dedicado de Ucarianos.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al consultar Google Sheets.' },
      { status: 502 }
    );
  }
}

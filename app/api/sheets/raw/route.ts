import { hasGoogleSheetsConfig, fetchSheetValues, rowsToObjects } from '@/lib/google-sheets';

export async function GET(request: Request) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range')?.trim() || process.env.GOOGLE_SHEET_UCARIANOS_RANGE || 'A1:Z200';

  if (!hasGoogleSheetsConfig() || !spreadsheetId) {
    return Response.json(
      { error: 'Google Sheets no esta configurado en esta app. Revisa GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY y GOOGLE_SHEET_ID.' },
      { status: 503 }
    );
  }

  try {
    const rawRows = await fetchSheetValues(spreadsheetId, range);
    const rows = rowsToObjects(rawRows);

    return Response.json(
      { source: 'google-sheets', range, rows, rawRows },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al consultar el rango del Google Sheet.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al consultar Google Sheets.' },
      { status: 502 }
    );
  }
}

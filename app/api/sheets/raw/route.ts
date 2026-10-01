import { hasGoogleSheetsConfig, fetchSheetOrExcelValues, fetchSpreadsheetTabTitles, rowsToObjects } from '@/lib/google-sheets';

export async function GET(request: Request) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range')?.trim() || 'A1:G47';

  if (!hasGoogleSheetsConfig() || !spreadsheetId) {
    return Response.json(
      { error: 'Google Sheets no esta configurado en esta app. Revisa GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY y GOOGLE_SHEET_ID.' },
      { status: 503 }
    );
  }

  if (searchParams.get('list') === 'tabs') {
    try {
      const tabs = await fetchSpreadsheetTabTitles(spreadsheetId);
      return Response.json({ tabs }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      console.error('Error al listar las pestañas del Google Sheet.', error);
      return Response.json(
        { error: error instanceof Error ? error.message : 'Error desconocido al listar las pestañas.' },
        { status: 502 }
      );
    }
  }

  try {
    const rawRows = await fetchSheetOrExcelValues(spreadsheetId, range);
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

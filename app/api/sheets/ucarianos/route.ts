import { hasGoogleSheetsConfig, fetchSheetValues, rowsToObjects } from '@/lib/google-sheets';

export async function GET() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_UCARIANOS_RANGE || 'Ucarianos';

  if (!hasGoogleSheetsConfig() || !spreadsheetId) {
    return Response.json(
      { error: 'Google Sheets no esta configurado en esta app.' },
      { status: 503 }
    );
  }

  try {
    const rows = await fetchSheetValues(spreadsheetId, range);
    const ucarianos = rowsToObjects(rows);

    return Response.json(
      { source: 'google-sheets', ucarianos },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al consultar Ucarianos desde Google Sheets.', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al consultar Google Sheets.' },
      { status: 502 }
    );
  }
}

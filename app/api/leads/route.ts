import { hasGoogleSheetsConfig } from '@/lib/google-sheets';
import { fetchLeadsForDate } from '@/lib/leads-sheet';

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date')?.trim() || todayIso();

  if (!hasGoogleSheetsConfig() || !spreadsheetId) {
    return Response.json(
      { error: 'Google Sheets no esta configurado en esta app. Revisa GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY y GOOGLE_SHEET_ID.' },
      { status: 503 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'El parametro date debe tener el formato YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const data = await fetchLeadsForDate(spreadsheetId, date);
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al consultar Prospectos desde el Sheet publico de Leads.', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al consultar Prospectos.' },
      { status: 502 }
    );
  }
}

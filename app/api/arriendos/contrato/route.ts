import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fetchArriendoContractDetail, buildTemplateValues } from '@/lib/arriendos';

// La plantilla no vive en /public, hay que leerla del filesystem del proyecto (requiere runtime Node).
export const runtime = 'nodejs';

const TEMPLATE_PATH = path.join(process.cwd(), 'UCARS_Contrato_Ucariano_PLANTILLA.html');

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
}

// Genera el contrato listo para imprimir/guardar como PDF desde el navegador (?imprimir=1 dispara window.print()).
export async function GET(request: Request) {
  const notionToken = process.env.NOTION_API_KEY;

  if (!notionToken) {
    return Response.json({ error: 'Falta NOTION_API_KEY.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const arriendoId = searchParams.get('id')?.trim();
  const shouldPrint = searchParams.get('imprimir') === '1';

  if (!arriendoId) {
    return Response.json({ error: 'Falta el parametro id (arriendo de Notion).' }, { status: 400 });
  }

  try {
    const [detail, template] = await Promise.all([
      fetchArriendoContractDetail(arriendoId, notionToken),
      fs.readFile(TEMPLATE_PATH, 'utf8')
    ]);

    const values = buildTemplateValues(detail);
    let html = fillTemplate(template, values);

    if (shouldPrint) {
      html = html.replace('</body>', '<script>window.onload = function () { window.focus(); window.print(); };</script></body>');
    }

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Error al generar el contrato de arriendo.', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al generar el contrato.' },
      { status: 500 }
    );
  }
}

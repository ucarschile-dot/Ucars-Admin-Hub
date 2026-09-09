import { promises as fs } from 'node:fs';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import {
  fetchArriendoContractDetail,
  buildTemplateValues,
  ensureArriendoSchema,
  uploadFileToNotion,
  attachFileToPageProperty,
  pickSchemaPropertyName,
  CONTRACT_PDF_CANDIDATES
} from '@/lib/arriendos';

// La plantilla no vive en /public, hay que leerla del filesystem del proyecto; ademas Puppeteer/Chromium
// solo corren en runtime Node (no Edge).
export const runtime = 'nodejs';
// Lanzar Chromium headless y subir el PDF a Notion puede tardar varios segundos en frio.
export const maxDuration = 60;

const TEMPLATE_PATH = path.join(process.cwd(), 'UCARS_Contrato_Ucariano_PLANTILLA.html');

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'contrato';
}

async function renderHtmlToPdf(html: string) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// Guarda el PDF generado en la propiedad "Contrato PDF" del arriendo (best-effort: si falla, no rompe la
// descarga/impresion del contrato, solo se loguea).
async function saveContractPdfToNotion(arriendoId: string, filename: string, html: string, notionToken: string) {
  const databaseId = process.env.NOTION_ARRIENDOS_DATABASE_ID;
  if (!databaseId) return;

  const schema = await ensureArriendoSchema(databaseId, notionToken);
  const pdfPropertyName = pickSchemaPropertyName(schema, CONTRACT_PDF_CANDIDATES);
  if (!pdfPropertyName) return;

  const pdfBuffer = await renderHtmlToPdf(html);
  const fileUploadId = await uploadFileToNotion(pdfBuffer, filename, 'application/pdf', notionToken);
  await attachFileToPageProperty(arriendoId, pdfPropertyName, fileUploadId, filename, notionToken);
}

// Genera el contrato, lo guarda como PDF en Notion (propiedad "Contrato PDF") y lo devuelve listo para
// imprimir/guardar como PDF desde el navegador (?imprimir=1 dispara window.print()).
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
    const filledHtml = fillTemplate(template, values);
    const filename = `Contrato-${slugify(detail.numeroContrato)}-${slugify(detail.autoName)}.pdf`;

    try {
      await saveContractPdfToNotion(arriendoId, filename, filledHtml, notionToken);
    } catch (pdfError) {
      console.error('No se pudo guardar el PDF del contrato en Notion.', pdfError);
    }

    let html = filledHtml;
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

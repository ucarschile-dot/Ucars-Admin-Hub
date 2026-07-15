import { readFile } from 'node:fs/promises';
import path from 'node:path';

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png'
};

export async function GET(_: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const safeName = path.basename(file);
  const extension = path.extname(safeName).toLowerCase();
  const contentType = mimeTypes[extension];

  if (!contentType) {
    return new Response('Unsupported file type.', { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), 'stitch-export', safeName);
    const body = await readFile(filePath);

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return new Response('File not found.', { status: 404 });
  }
}
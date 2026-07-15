import { readFile } from 'node:fs/promises';
import path from 'node:path';

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
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
    const stitchExportPath = path.join(process.cwd(), 'stitch-export', safeName);
    let body: Buffer;

    try {
      body = await readFile(stitchExportPath);
    } catch {
      const rootPath = path.join(process.cwd(), safeName);
      body = await readFile(rootPath);
    }

    const cacheControl = extension === '.png'
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=300, stale-while-revalidate=600';

    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl
      }
    });
  } catch {
    return new Response('File not found.', { status: 404 });
  }
}
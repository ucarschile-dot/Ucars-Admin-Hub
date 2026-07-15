import type { StitchScreenKey } from '@/lib/stitch-screen-data';
import { getStitchScreenDocument } from '@/lib/stitch-screen-data';

type StitchScreenFrameProps = {
  screen: StitchScreenKey;
};

export async function StitchScreenFrame({ screen }: StitchScreenFrameProps) {
  const document = await getStitchScreenDocument(screen);

  return (
    <main className="stitch-screen-page">
      <div className="stitch-screen-meta">
        <div>
          <p className="stitch-screen-label">Stitch Source</p>
          <h1>{document.title}</h1>
          <p>
            Proyecto {document.projectId} · Pantalla {document.screenId}
          </p>
        </div>
        <div className="stitch-screen-actions">
          <a href={`/stitch-export/${document.fileName}`} target="_blank" rel="noreferrer">
            Abrir HTML
          </a>
          <a href={`/stitch-export/${document.imageName}`} target="_blank" rel="noreferrer">
            Abrir PNG
          </a>
        </div>
      </div>

      <section className="stitch-screen-canvas">
        <iframe
          title={document.title}
          srcDoc={document.html}
          className="stitch-screen-iframe"
          style={{ height: `${document.height}px` }}
        />
      </section>
    </main>
  );
}
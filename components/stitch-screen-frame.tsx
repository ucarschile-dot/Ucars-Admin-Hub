import type { StitchScreenKey } from '@/lib/stitch-screen-data';
import { getStitchScreenDocument } from '@/lib/stitch-screen-data';

type StitchScreenFrameProps = {
  screen: StitchScreenKey;
};

export async function StitchScreenFrame({ screen }: StitchScreenFrameProps) {
  const document = await getStitchScreenDocument(screen);

  return (
    <main className="stitch-screen-page">
      <iframe
        title={document.title}
        src={`/stitch-export/${document.fileName}`}
        className="stitch-screen-iframe"
      />
    </main>
  );
}
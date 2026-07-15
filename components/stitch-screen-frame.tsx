import type { StitchScreenKey } from '@/lib/stitch-screen-data';

type StitchScreenFrameProps = {
  screen: StitchScreenKey;
};

const screenTitles: Record<StitchScreenKey, string> = {
  stock: 'Stock - Ucars Hub',
  ucarianos: 'Ucarianos - Ucars Hub',
  agenda: 'Agenda - Ucars Hub',
  notificaciones: 'Notificaciones - Ucars Hub'
};

export function StitchScreenFrame({ screen }: StitchScreenFrameProps) {
  const title = screenTitles[screen];

  return (
    <main className="stitch-screen-page">
      <iframe
        title={title}
        src={`/stitch-export/index.html#${screen}`}
        className="stitch-screen-iframe"
      />
    </main>
  );
}
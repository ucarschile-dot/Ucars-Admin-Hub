import type { StitchScreenKey } from '@/lib/stitch-screen-data';

type StitchScreenFrameProps = {
  screen: StitchScreenKey;
};

// Titulos accesibles del iframe para cada una de las pantallas visibles del Hub.
const screenTitles: Record<StitchScreenKey, string> = {
  stock: 'Stock - Ucars Hub',
  ucarianos: 'Ucarianos - Ucars Hub',
  agenda: 'Agenda - Ucars Hub',
  leads: 'Prospectos - Ucars Hub',
  notificaciones: 'Notificaciones - Ucars Hub',
  pruebas: 'Pruebas - Ucars Hub'
};

export function StitchScreenFrame({ screen }: StitchScreenFrameProps) {
  const title = screenTitles[screen];

  return (
    // Marco React: abre la pantalla solicitada dentro del contenedor Stitch compartido.
    <main className="stitch-screen-page">
      <iframe
        title={title}
        src={`/stitch-export/index.html#${screen}`}
        className="stitch-screen-iframe"
      />
    </main>
  );
}
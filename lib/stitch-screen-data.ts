import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type StitchScreenKey = 'agenda' | 'notificaciones' | 'stock' | 'ucarianos';

type StitchScreenMeta = {
  fileName: string;
  imageName: string;
  title: string;
  projectId: string;
  screenId: string;
  height: number;
};

const projectId = '2472059739280843263';

export const stitchScreens: Record<StitchScreenKey, StitchScreenMeta> = {
  agenda: {
    fileName: 'agenda.html',
    imageName: 'agenda.png',
    title: 'Agenda - Ucars Hub',
    projectId,
    screenId: '53d3ead78b4d46e892ba7df4ff67931e',
    height: 2048
  },
  notificaciones: {
    fileName: 'notificaciones.html',
    imageName: 'notificaciones.png',
    title: 'Notificaciones - Ucars Hub',
    projectId,
    screenId: 'cb308bfa20444a5fb8052a925ebedd82',
    height: 2048
  },
  stock: {
    fileName: 'stock.html',
    imageName: 'stock.png',
    title: 'Stock - Ucars Hub',
    projectId,
    screenId: 'cdb8f0e18c7e4d649e8e3b4ba86d6140',
    height: 2048
  },
  ucarianos: {
    fileName: 'ucarianos.html',
    imageName: 'ucarianos.png',
    title: 'Ucarianos - Ucars Hub',
    projectId,
    screenId: '750b710fae524f41ac36601d6d9a7676',
    height: 2176
  }
};

export async function getStitchScreenDocument(key: StitchScreenKey) {
  const screen = stitchScreens[key];
  const filePath = path.join(process.cwd(), 'stitch-export', screen.fileName);
  const html = await readFile(filePath, 'utf8');

  return {
    ...screen,
    html
  };
}
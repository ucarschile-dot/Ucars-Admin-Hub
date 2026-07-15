import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { stitchTheme } from '@/lib/stitch-theme';
import './globals.css';

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap'
});

const headingFont = Montserrat({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Ucars Admin Hub',
  description: 'Panel administrativo para la operación de stock, vendedores, agenda y notificaciones de Ucars.',
  applicationName: stitchTheme.name,
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    shortcut: ['/icons/icon-192.png']
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body
        className={`${bodyFont.variable} ${headingFont.variable}`}
        data-stitch-project={stitchTheme.projectId}
        data-stitch-asset={stitchTheme.assetId}
      >
        {children}
      </body>
    </html>
  );
}
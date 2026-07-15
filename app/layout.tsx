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
  applicationName: stitchTheme.name
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
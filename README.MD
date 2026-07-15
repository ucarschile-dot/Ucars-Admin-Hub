# Ucars Admin Hub

Aplicación web administrativa para Ucars, construida con Next.js y preparada para desplegarse en Vercel usando Notion como fuente de datos.

## Ventanas incluidas

- Stock
- Ucarianos
- Agenda
- Notificaciones

## Stack

- Next.js 15 con App Router
- React 18
- TypeScript
- Notion SDK
- Stitch MCP como fuente del sistema visual

## Variables de entorno

Duplica `.env.example` como `.env.local` y completa:

```bash
NOTION_API_KEY=
NOTION_STOCK_DATABASE_ID=
NOTION_USERS_DATABASE_ID=
NOTION_AGENDA_DATABASE_ID=
NOTION_NOTIFICATIONS_DATABASE_ID=
NEXT_PUBLIC_APP_NAME=Ucars Admin Hub
```

Si estas variables no existen o fallan las consultas, la app entra en modo demo con datos mock para no bloquear desarrollo ni despliegue inicial.

## Desarrollo local

```bash
npm install
npm run dev
```

## Despliegue en Vercel

1. Importa el repositorio `ucarschile-dot/Ucars-Admin-Hub` en Vercel.
2. Configura las variables `NOTION_*` en el panel de Environment Variables.
3. Usa `npm run build` como comando de build y deja el output estándar de Next.js.

## Mapeo Notion

La capa `lib/notion.ts` ya intenta resolver variaciones comunes de nombres de propiedades en español e inglés. Si tus columnas reales difieren, ajusta solo ese archivo y la UI seguirá intacta.

## Conexión con Stitch

La app ahora quedó alineada al asset generado en Stitch:

- Proyecto: `projects/14626129994960626249`
- Asset de diseño: `assets/ea662268049e4e618a5a6f6f5e8cd336`
- Fuente display: Montserrat
- Fuente body: Inter

La referencia técnica está en `lib/stitch-theme.ts` y el layout expone esos ids en atributos `data-stitch-*` del `body`. Los tokens principales de color, spacing y elevación quedaron sincronizados en `app/globals.css`.

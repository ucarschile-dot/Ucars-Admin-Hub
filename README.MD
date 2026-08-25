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
PUBLIC_SITE_URL=https://ucars.cl
UCARS_API_KEY=
VEEKLS_API_URL=https://public.api.veekls.com
VEEKLS_ORG_ID=
VEEKLS_SECRET_KEY=
VEEKLS_BASIC_AUTH=
AUTH_SECRET=
NEXT_PUBLIC_APP_NAME=Ucars Admin Hub
```

Para stock web desde Veekls usa una de estas dos opciones:

- Opcion A (recomendada): `VEEKLS_ORG_ID` + `VEEKLS_SECRET_KEY` (secret cruda)
- Opcion B (si ya te entregaron token Base64): `VEEKLS_BASIC_AUTH` con el token ya codificado

Si defines `VEEKLS_BASIC_AUTH`, la app lo prioriza automaticamente sobre `VEEKLS_ORG_ID` y `VEEKLS_SECRET_KEY`.

Si estas variables no existen o fallan las consultas, la app entra en modo demo con datos mock para no bloquear desarrollo ni despliegue inicial. La autenticacion administrativa requiere `NOTION_API_KEY`, `NOTION_USERS_DATABASE_ID` y un `AUTH_SECRET` estable para firmar la sesion.

## Acceso administrativo

La entrada al panel ahora valida estas propiedades en la base de Ucarianos de Notion:

- `Email`
- `PIN`
- `Rol` con la opcion `Administrador` en la lista

Si el usuario no tiene `Administrador` dentro de `Rol`, el acceso se rechaza aunque tenga otros roles como `Vendedor`.

## Desarrollo local

```bash
npm install
npm run dev
```

## Despliegue en Vercel

1. Importa el repositorio `ucarschile-dot/Ucars-Admin-Hub` en Vercel.
2. Configura las variables `NOTION_*` y `VEEKLS_*` en el panel de Environment Variables.
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

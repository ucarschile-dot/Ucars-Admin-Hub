const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

type CachedToken = { accessToken: string; expiresAt: number };

let cachedToken: CachedToken | null = null;

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function hasGoogleSheetsConfig() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
}

function getServiceAccountCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.');
  }

  // Env vars store the key with escaped newlines; restore real line breaks before signing.
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  return { email, privateKey };
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const { email, privateKey } = getServiceAccountCredentials();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: email,
    scope: READONLY_SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600
  };

  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;

  const { createSign } = await import('node:crypto');
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = base64UrlEncode(signer.sign(privateKey));

  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }),
    cache: 'no-store'
  });

  const payload = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || 'No se pudo autenticar con la cuenta de servicio de Google.');
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in || 3600) * 1000
  };

  return cachedToken.accessToken;
}

/** Fetches a sheet range as raw rows (first row treated as header by callers). */
export async function fetchSheetValues(spreadsheetId: string, range: string): Promise<string[][]> {
  const accessToken = await getAccessToken();
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });

  const payload = (await response.json()) as { values?: string[][]; error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'No se pudo consultar el Google Sheet.');
  }

  return payload.values || [];
}

/** Converts a sheet's first row into headers and maps remaining rows into objects. */
export function rowsToObjects(rows: string[][]): Array<Record<string, string>> {
  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());

  return dataRows
    .filter((row) => row.some((cell) => (cell || '').trim() !== ''))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (header) {
          record[header] = (row[index] || '').trim();
        }
      });
      return record;
    });
}

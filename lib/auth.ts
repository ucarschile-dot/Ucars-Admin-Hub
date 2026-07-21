import type { AdminLoginProfile } from '@/lib/notion';

export const ADMIN_SESSION_COOKIE = 'ucars_admin_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;

type AdminSessionPayload = {
  email: string;
  name: string;
  roles: string[];
  exp: number;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NOTION_API_KEY || '';

  if (!secret) {
    throw new Error('Missing AUTH_SECRET or NOTION_API_KEY for admin auth.');
  }

  return secret;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importSigningKey() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signSegment(value: string) {
  const key = await importSigningKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function buildSessionPayload(profile: AdminLoginProfile): AdminSessionPayload {
  return {
    email: profile.email,
    name: profile.name,
    roles: profile.roles,
    exp: Date.now() + SESSION_DURATION_MS
  };
}

export async function createAdminSessionToken(profile: AdminLoginProfile) {
  const payload = buildSessionPayload(profile);
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signSegment(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split('.');

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = await signSegment(encodedPayload);

  if (expectedSignature !== providedSignature) {
    return null;
  }

  const decodedPayload = new TextDecoder().decode(decodeBase64Url(encodedPayload));
  const payload = JSON.parse(decodedPayload) as AdminSessionPayload;

  if (!Array.isArray(payload.roles) || !payload.email || !payload.name || typeof payload.exp !== 'number') {
    return null;
  }

  if (payload.exp <= Date.now()) {
    return null;
  }

  const isAdmin = payload.roles.some(
    (role) => role.localeCompare('Administrador', 'es', { sensitivity: 'accent' }) === 0
  );

  return isAdmin ? payload : null;
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000
  };
}
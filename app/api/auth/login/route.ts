import { NextResponse } from 'next/server';
import { createAdminSessionToken, getAdminSessionCookieOptions, ADMIN_SESSION_COOKIE } from '@/lib/auth';
import { authenticateAdminByCredentials, hasAdminAuthConfig } from '@/lib/notion';

type LoginBody = {
  email?: string;
  pin?: string;
};

export async function POST(request: Request) {
  if (!hasAdminAuthConfig()) {
    return NextResponse.json(
      { error: 'La autenticacion administrativa no esta configurada.' },
      { status: 503 }
    );
  }

  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 });
  }

  const profile = await authenticateAdminByCredentials(body.email || '', body.pin || '');

  if (!profile) {
    return NextResponse.json(
      { error: 'Credenciales invalidas o sin permisos de administrador.' },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true, redirectTo: '/' });
  response.cookies.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(profile), getAdminSessionCookieOptions());
  return response;
}
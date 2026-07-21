import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth';

const LOGIN_PATH = '/login';
const AUTH_API_PREFIX = '/api/auth';

function isApiRequest(pathname: string) {
  return pathname.startsWith('/api/');
}

function isPublicPath(pathname: string) {
  return pathname === LOGIN_PATH || pathname.startsWith(AUTH_API_PREFIX);
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    if (pathname === LOGIN_PATH) {
      const session = await verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

      if (session) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return NextResponse.next();
  }

  const session = await verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (session) {
    return NextResponse.next();
  }

  if (isApiRequest(pathname)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)']
};
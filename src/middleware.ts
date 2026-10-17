import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_REFRESH_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_REFRESH_MAX_AGE,
  adminCookieOptions,
  checkAdminAuth,
  refreshSupabaseSession,
} from '@/lib/adminAuth';

// Endpoints that must stay reachable without a session (login/logout).
const PUBLIC_ADMIN_API = ['/api/admin/login', '/api/admin/logout'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminApi = pathname.startsWith('/api/admin') || pathname === '/api/upload';
  const isAdminPage = pathname.startsWith('/admin');

  if (!isAdminApi && !isAdminPage) return NextResponse.next();
  if (isAdminApi && PUBLIC_ADMIN_API.includes(pathname)) return NextResponse.next();
  if (pathname === '/admin/login') return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  let result = await checkAdminAuth(token);
  let refreshed: { accessToken: string; refreshToken: string; expiresIn: number } | null = null;

  // Access token expired (or rotated): try the refresh token once.
  if (!result.ok && result.reason === 'unauthenticated' && token) {
    const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
    if (refreshToken) {
      refreshed = await refreshSupabaseSession(refreshToken);
      if (refreshed) {
        result = await checkAdminAuth(refreshed.accessToken);
      }
    }
  }

  if (!result.ok) {
    if (isAdminApi) {
      const notConfigured = result.reason === 'not_configured';
      return NextResponse.json(
        {
          error: notConfigured
            ? 'Admin access is not configured on the server.'
            : 'Unauthorized',
        },
        { status: notConfigured ? 503 : 401 }
      );
    }

    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(ADMIN_COOKIE);
    response.cookies.delete(ADMIN_REFRESH_COOKIE);
    return response;
  }

  const response = NextResponse.next();
  if (refreshed) {
    response.cookies.set(ADMIN_COOKIE, refreshed.accessToken, adminCookieOptions(ADMIN_COOKIE_MAX_AGE));
    response.cookies.set(
      ADMIN_REFRESH_COOKIE,
      refreshed.refreshToken,
      adminCookieOptions(ADMIN_REFRESH_MAX_AGE)
    );
  }
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/upload'],
};

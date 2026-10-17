// Node-runtime admin guards used by API route handlers and admin server pages.
// (The edge-safe building blocks live in `src/lib/adminAuth.ts`.)

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, checkAdminAuth } from './adminAuth';

/**
 * Guard for API route handlers.
 * Returns a NextResponse (401/403/503) when the caller is not the verified
 * admin, or null when the request is authorized.
 *
 * Usage:
 *   const authError = await requireAdminApi();
 *   if (authError) return authError;
 */
export async function requireAdminApi(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const result = await checkAdminAuth(token);

  if (result.ok) return null;

  if (result.reason === 'not_configured') {
    return NextResponse.json(
      {
        error:
          'Admin access is not configured on the server. Set ADMIN_EMAIL and the Supabase environment variables.',
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: result.reason === 'not_admin' ? 403 : 401 }
  );
}

/** Guard for admin server components/pages: redirects to the login page when unauthorized. */
export async function requireAdminPage(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const result = await checkAdminAuth(token);
  if (!result.ok) {
    redirect('/admin/login');
  }
}

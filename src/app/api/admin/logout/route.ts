import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_REFRESH_COOKIE } from '@/lib/adminAuth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set(ADMIN_REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}

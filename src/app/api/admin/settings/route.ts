import { NextRequest, NextResponse } from 'next/server';
import { updateSiteSettings, getSiteSettings } from '@/lib/supabaseServer';
import { requireAdminApi } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const settings = await getSiteSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const body = await req.json();

    // Only allow the known CMS fields through.
    const allowedFields = [
      'announcement_text',
      'hero_headline',
      'hero_subheadline',
      'hero_banner_image',
    ] as const;

    const payload: Record<string, string> = {};
    for (const field of allowedFields) {
      if (typeof body[field] === 'string') {
        payload[field] = body[field];
      }
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No valid settings fields provided.' }, { status: 400 });
    }

    const updated = await updateSiteSettings(payload);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    console.error('Error updating site settings:', error);
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PUT(req);
}

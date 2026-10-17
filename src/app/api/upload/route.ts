import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabaseServer';
import { requireAdminApi } from '@/lib/adminGuard';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 6;

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Determine the real image type from the file's magic bytes.
 * Never trust the client-supplied MIME type or file extension.
 */
function detectImageType(buffer: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided for upload' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files in one upload (max ${MAX_FILES}).` },
        { status: 400 }
      );
    }

    const uploadedUrls: string[] = [];
    const supabase = getSupabaseAdminClient();

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds the 5MB size limit.` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const detectedType = detectImageType(buffer);

      if (!detectedType) {
        return NextResponse.json(
          { error: `"${file.name}" is not a valid PNG, JPEG or WEBP image.` },
          { status: 400 }
        );
      }

      const fileName = `${randomUUID()}.${EXT_BY_TYPE[detectedType]}`;
      const filePath = `uploads/${fileName}`;

      if (supabase) {
        const { error: uploadError } = await supabase.storage
          .from('product-media')
          .upload(filePath, buffer, {
            contentType: detectedType,
            upsert: false,
          });

        if (uploadError) {
          console.error('Supabase storage upload error:', uploadError.message);
          return NextResponse.json(
            { error: 'Image storage is unavailable right now. Please try again.' },
            { status: 502 }
          );
        }

        const { data: publicUrlData } = supabase.storage
          .from('product-media')
          .getPublicUrl(filePath);
        uploadedUrls.push(publicUrlData.publicUrl);
      } else if (process.env.NODE_ENV !== 'production') {
        // Development-only fallback so the media picker works without storage.
        const base64 = buffer.toString('base64');
        uploadedUrls.push(`data:${detectedType};base64,${base64}`);
      } else {
        return NextResponse.json(
          { error: 'Image uploads are not configured on this server.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json({ urls: uploadedUrls });
  } catch (err: any) {
    console.error('Upload handler error:', err);
    return NextResponse.json({ error: 'File upload failed.' }, { status: 500 });
  }
}

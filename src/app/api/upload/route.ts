import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseServer';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided for upload' }, { status: 400 });
    }

    const uploadedUrls: string[] = [];
    const supabase = getSupabaseAdminClient();

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Allowed: PNG, JPEG, WEBP.` },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 5MB size limit.` },
          { status: 400 }
        );
      }

      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const buffer = Buffer.from(await file.arrayBuffer());

      if (supabase) {
        const { error: uploadError } = await supabase.storage
          .from('product-media')
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.warn('Supabase storage upload error, falling back:', uploadError.message);
          // Fallback to base64 data URL
          const base64 = buffer.toString('base64');
          uploadedUrls.push(`data:${file.type};base64,${base64}`);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('product-media')
            .getPublicUrl(filePath);
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      } else {
        // Fallback for development without active bucket
        const base64 = buffer.toString('base64');
        uploadedUrls.push(`data:${file.type};base64,${base64}`);
      }
    }

    return NextResponse.json({ urls: uploadedUrls });
  } catch (err: any) {
    console.error('Upload handler error:', err);
    return NextResponse.json({ error: err.message || 'File upload failed' }, { status: 500 });
  }
}

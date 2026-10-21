import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('receipt') as File | null;
    const orderId = (formData.get('order_id') as string | null) || 'unknown';

    if (!file) {
      return NextResponse.json({ error: 'No receipt file provided.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 10MB limit. Please upload a smaller screenshot or PDF.' },
        { status: 400 }
      );
    }

    const mime = file.type || 'image/jpeg';
    let ext = 'jpg';
    if (mime.includes('png')) ext = 'png';
    else if (mime.includes('webp')) ext = 'webp';
    else if (mime.includes('pdf')) ext = 'pdf';

    const cleanOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    const fileName = `receipts/${cleanOrderId}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

    const supabase = getSupabaseAdminClient();
    let publicUrl = '';

    if (supabase) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const { error: uploadError } = await supabase.storage
          .from('product-media')
          .upload(fileName, buffer, {
            contentType: mime,
            upsert: true,
          });

        if (!uploadError) {
          const { data } = supabase.storage.from('product-media').getPublicUrl(fileName);
          publicUrl = data?.publicUrl || '';
        } else {
          console.warn('Receipt upload to Supabase storage:', uploadError.message);
        }
      } catch (storageErr) {
        console.warn('Storage upload exception:', storageErr);
      }
    }

    return NextResponse.json({
      success: true,
      receiptUrl: publicUrl || `/uploads/${fileName}`,
      message: 'Receipt received successfully. Our team will verify and dispatch your order.',
    });
  } catch (err: any) {
    console.error('Receipt upload error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process receipt upload.' },
      { status: 500 }
    );
  }
}

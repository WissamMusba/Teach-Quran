import { NextRequest, NextResponse } from 'next/server';
import { createProduct } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      slug,
      category,
      brand,
      description,
      price,
      stock_quantity,
      images,
      specifications,
      is_featured,
      is_active,
    } = body;

    if (!title || !category || !brand || price === undefined) {
      return NextResponse.json({ error: 'Missing required product fields' }, { status: 400 });
    }

    const generatedSlug =
      slug ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    const newProduct = await createProduct({
      title,
      slug: generatedSlug,
      category,
      brand,
      description: description || null,
      price: Number(price),
      stock_quantity: Number(stock_quantity || 0),
      images: images || [],
      specifications: specifications || {},
      is_featured: Boolean(is_featured),
      is_active: is_active !== undefined ? Boolean(is_active) : true,
    });

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: error.message || 'Failed to create product' }, { status: 500 });
  }
}

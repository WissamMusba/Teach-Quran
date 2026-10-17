import { NextRequest, NextResponse } from 'next/server';
import { createProduct } from '@/lib/supabaseServer';
import { requireAdminApi } from '@/lib/adminGuard';

export async function POST(req: NextRequest) {
  const authError = await requireAdminApi();
  if (authError) return authError;

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

    // Server-side validation
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanBrand = typeof brand === 'string' ? brand.trim() : '';
    const cleanCategory = typeof category === 'string' ? category.trim().toLowerCase() : '';
    const allowedCategories = ['bats', 'balls', 'pads', 'gloves', 'helmets', 'bags', 'shoes'];

    if (!cleanTitle || !cleanBrand || !allowedCategories.includes(cleanCategory)) {
      return NextResponse.json(
        {
          error:
            'Missing or invalid product fields. title, brand and a valid category are required.',
        },
        { status: 400 }
      );
    }

    const numericPrice = Number(price);
    const numericStock = Number(stock_quantity ?? 0);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'Price must be a number ≥ 0.' }, { status: 400 });
    }
    if (!Number.isInteger(numericStock) || numericStock < 0) {
      return NextResponse.json(
        { error: 'Stock quantity must be a whole number ≥ 0.' },
        { status: 400 }
      );
    }

    const generatedSlug = (
      typeof slug === 'string' && slug.trim()
        ? slug.trim()
        : cleanTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '')
    ).toLowerCase();

    const newProduct = await createProduct({
      title: cleanTitle,
      slug: generatedSlug,
      category: cleanCategory,
      brand: cleanBrand,
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
      price: numericPrice,
      stock_quantity: numericStock,
      images: Array.isArray(images) ? images.filter((u) => typeof u === 'string') : [],
      specifications:
        specifications && typeof specifications === 'object' ? specifications : {},
      is_featured: Boolean(is_featured),
      is_active: is_active !== undefined ? Boolean(is_active) : true,
    });

    if (!newProduct) {
      return NextResponse.json(
        { error: 'Could not save the product. Check that the slug is unique and the database is reachable.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product.' }, { status: 500 });
  }
}

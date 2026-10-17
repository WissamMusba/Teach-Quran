import React from 'react';
import { notFound } from 'next/navigation';
import { getProductById } from '@/lib/supabaseServer';
import { ProductForm } from '@/components/admin/ProductForm';

export const revalidate = 0;

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
          Edit Gear: {product.title}
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Update price, stock levels, willow specifications, or equipment imagery.
        </p>
      </div>

      <ProductForm initialData={product} isEditing={true} />
    </div>
  );
}

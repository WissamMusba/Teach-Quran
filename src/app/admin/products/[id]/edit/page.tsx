import React from 'react';
import { notFound } from 'next/navigation';
import { getProductById } from '@/lib/supabaseServer';
import { ProductForm } from '@/components/admin/ProductForm';
import { requireAdminPage } from '@/lib/adminGuard';

export const revalidate = 0;

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  await requireAdminPage();
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-8 text-white max-w-4xl">
      <div className="pb-6 border-b border-[#1C1C24]">
        <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-white tracking-tight">
          Edit Gear: {product.title}
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Update price, stock levels, willow specifications, or equipment imagery.
        </p>
      </div>

      <ProductForm initialData={product} isEditing={true} />
    </div>
  );
}

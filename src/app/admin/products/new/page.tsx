import React from 'react';
import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div className="space-y-8 text-white max-w-4xl">
      <div className="pb-6 border-b border-[#1C1C24]">
        <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-white tracking-tight">
          Add New Cricket Equipment
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Specify willow details, specifications, single non-promotional price, and upload equipment photos.
        </p>
      </div>

      <ProductForm isEditing={false} />
    </div>
  );
}

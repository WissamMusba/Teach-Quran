import React from 'react';
import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
          Add New Cricket Equipment
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Specify willow details, specifications, single non-promotional price, and upload equipment photos.
        </p>
      </div>

      <ProductForm isEditing={false} />
    </div>
  );
}

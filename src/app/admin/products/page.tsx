import React from 'react';
import Link from 'next/link';
import { getProducts } from '@/lib/supabaseServer';
import { ProductListTable } from '@/components/admin/ProductListTable';
import { Plus } from 'lucide-react';

export const revalidate = 0;

export default async function AdminProductsPage() {
  const products = await getProducts();

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            Inventory & Catalog Management
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Manage bats, balls, pads, and cricket armor. Toggle featured items for the storefront homepage.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Gear</span>
        </Link>
      </div>

      <ProductListTable initialProducts={products} />
    </div>
  );
}

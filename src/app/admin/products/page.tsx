import React from 'react';
import Link from 'next/link';
import { getProducts } from '@/lib/supabaseServer';
import { requireAdminPage } from '@/lib/adminGuard';
import { ProductListTable } from '@/components/admin/ProductListTable';
import { Plus } from 'lucide-react';

export const revalidate = 0;

export default async function AdminProductsPage() {
  await requireAdminPage();
  const products = await getProducts();

  return (
    <div className="space-y-8 max-w-7xl text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1C1C24]">
        <div>
          <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-white tracking-tight">
            Inventory & Catalog Management
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Manage bats, balls, pads, and cricket armor. Toggle featured items for the storefront homepage.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black text-xs uppercase tracking-wider transition-all shadow-orange-glow-sm active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-black" />
          <span>Add New Gear</span>
        </Link>
      </div>

      <ProductListTable initialProducts={products} />
    </div>
  );
}

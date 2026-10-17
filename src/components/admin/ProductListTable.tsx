'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Product } from '@/lib/types';
import { Edit2, Trash2, Star, CheckCircle, XCircle, Search } from 'lucide-react';

interface ProductListTableProps {
  initialProducts: Product[];
}

export const ProductListTable: React.FC<ProductListTableProps> = ({ initialProducts }) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const handleToggle = async (id: string, field: 'is_featured' | 'is_active', currentValue: boolean) => {
    const newValue = !currentValue;

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: newValue } : p))
    );

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      });
      if (!res.ok) {
        throw new Error('Update failed');
      }
    } catch (err) {
      console.error(err);
      // Revert on error
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: currentValue } : p))
      );
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search equipment by title or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 capitalize w-full sm:w-auto"
          >
            <option value="all">All Categories</option>
            <option value="bats">Bats</option>
            <option value="balls">Balls</option>
            <option value="pads">Pads</option>
            <option value="gloves">Gloves</option>
            <option value="helmets">Helmets</option>
            <option value="bags">Bags</option>
            <option value="shoes">Shoes</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-100">
            <tr>
              <th className="py-3 px-5">Gear</th>
              <th className="py-3 px-5">Brand</th>
              <th className="py-3 px-5">Category</th>
              <th className="py-3 px-5">Price</th>
              <th className="py-3 px-5">Stock</th>
              <th className="py-3 px-5 text-center">Featured</th>
              <th className="py-3 px-5 text-center">Active</th>
              <th className="py-3 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-neutral-400">
                  No matching cricket products found.
                </td>
              </tr>
            ) : (
              filtered.map((product) => (
                <tr key={product.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="py-3 px-5">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.images?.[0] || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=200&auto=format&fit=crop'}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 max-w-xs">
                        <span className="font-bold text-neutral-900 block truncate">
                          {product.title}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          /{product.slug}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-5 font-semibold text-neutral-700">{product.brand}</td>
                  <td className="py-3 px-5 uppercase text-[10px] tracking-wider font-bold text-neutral-500">
                    {product.category}
                  </td>
                  <td className="py-3 px-5 font-bold text-neutral-900">
                    ${product.price.toFixed(2)}
                  </td>
                  <td className="py-3 px-5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                        product.stock_quantity <= 5
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      {product.stock_quantity}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-center">
                    <button
                      onClick={() => handleToggle(product.id, 'is_featured', product.is_featured)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        product.is_featured
                          ? 'text-orange-500 bg-orange-50 hover:bg-orange-100'
                          : 'text-neutral-300 hover:text-neutral-500'
                      }`}
                      title={product.is_featured ? 'Featured on home' : 'Click to feature'}
                    >
                      <Star className={`w-4 h-4 ${product.is_featured ? 'fill-orange-500' : ''}`} />
                    </button>
                  </td>
                  <td className="py-3 px-5 text-center">
                    <button
                      onClick={() => handleToggle(product.id, 'is_active', product.is_active)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        product.is_active
                          ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                          : 'text-neutral-300 hover:text-neutral-500'
                      }`}
                      title={product.is_active ? 'Active' : 'Hidden'}
                    >
                      {product.is_active ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-5 text-right space-x-1">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="inline-flex p-1.5 rounded-lg text-neutral-500 hover:text-orange-600 hover:bg-neutral-100 transition-colors"
                      title="Edit product"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id, product.title)}
                      className="inline-flex p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-neutral-100 transition-colors"
                      title="Delete product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

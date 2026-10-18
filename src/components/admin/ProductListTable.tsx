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
    const matchesCategory =
      categoryFilter === 'all' || p.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl shadow-xl overflow-hidden text-white">
      {/* Controls Bar */}
      <div className="p-5 border-b border-[#1C1C24] flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#0A0A0E]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search equipment by title or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3.5 py-2.5 rounded-xl border border-[#272730] bg-[#14141B] text-white focus:outline-none focus:border-[#FF5500] font-bold uppercase tracking-wider capitalize w-full sm:w-auto"
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

      {/* Mobile & Foldable Card List View */}
      <div className="md:hidden divide-y divide-[#1C1C24]">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500 px-4">
            No matching cricket products found.
          </div>
        ) : (
          filtered.map((product) => (
            <div key={product.id} className="p-4 space-y-3 hover:bg-[#12121A] transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-[#14141B] border border-[#252530] overflow-hidden shrink-0 flex items-center justify-center p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      product.images?.[0] ||
                      'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=200&auto=format&fit=crop'
                    }
                    alt={product.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-black text-[#FF5500]">
                      {product.brand}
                    </span>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold">•</span>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold">
                      {product.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-white line-clamp-1">{product.title}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-[10px] text-[#FF5500] font-black">AED</span>
                    <span className="font-display text-lg font-black text-white">
                      {product.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status and Action Controls */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1C1C24]/60">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                      product.stock_quantity <= 5
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-[#181822] text-neutral-300 border border-[#272735]'
                    }`}
                  >
                    {product.stock_quantity} left
                  </span>
                  <button
                    onClick={() => handleToggle(product.id, 'is_featured', product.is_featured)}
                    className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                      product.is_featured
                        ? 'text-[#FF5500] bg-[#FF5500]/10'
                        : 'text-neutral-500 bg-[#16161F]'
                    }`}
                    title={product.is_featured ? 'Featured' : 'Not featured'}
                  >
                    <Star className={`w-3.5 h-3.5 ${product.is_featured ? 'fill-[#FF5500]' : ''}`} />
                    <span className="text-[10px] font-bold">Featured</span>
                  </button>
                  <button
                    onClick={() => handleToggle(product.id, 'is_active', product.is_active)}
                    className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                      product.is_active
                        ? 'text-emerald-400 bg-emerald-950/60'
                        : 'text-neutral-500 bg-[#16161F]'
                    }`}
                    title={product.is_active ? 'Active' : 'Hidden'}
                  >
                    {product.is_active ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[10px] font-bold">{product.is_active ? 'Active' : 'Hidden'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="p-2 rounded-lg text-neutral-300 hover:text-white bg-[#181824] hover:bg-[#202030] transition-colors touch-target flex items-center justify-center"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4 text-[#FF5500]" />
                  </Link>
                  <button
                    onClick={() => handleDelete(product.id, product.title)}
                    className="p-2 rounded-lg text-neutral-400 hover:text-red-400 bg-[#181824] hover:bg-red-950/30 transition-colors touch-target flex items-center justify-center"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#121218] text-neutral-400 font-bold uppercase tracking-wider border-b border-[#1C1C24]">
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
          <tbody className="divide-y divide-[#1C1C24] text-neutral-300">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-neutral-500">
                  No matching cricket products found.
                </td>
              </tr>
            ) : (
              filtered.map((product) => (
                <tr key={product.id} className="hover:bg-[#14141C] transition-colors">
                  <td className="py-3 px-5">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-xl bg-[#14141B] border border-[#252530] overflow-hidden shrink-0 flex items-center justify-center p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            product.images?.[0] ||
                            'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=200&auto=format&fit=crop'
                          }
                          alt={product.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 max-w-xs">
                        <span className="font-bold text-white block truncate">
                          {product.title}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          /{product.slug}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-5 font-bold text-neutral-300">{product.brand}</td>
                  <td className="py-3 px-5 uppercase text-[10px] tracking-wider font-black text-[#FF5500]">
                    {product.category}
                  </td>
                  <td className="py-3 px-5 font-display text-lg font-black text-white">
                    AED {product.price.toLocaleString()}
                  </td>
                  <td className="py-3 px-5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded font-mono font-bold text-[11px] ${
                        product.stock_quantity <= 5
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-[#181822] text-neutral-300 border border-[#272735]'
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
                          ? 'text-[#FF5500] bg-[#FF5500]/10 hover:bg-[#FF5500]/20'
                          : 'text-neutral-600 hover:text-neutral-400'
                      }`}
                      title={product.is_featured ? 'Featured on home' : 'Click to feature'}
                    >
                      <Star className={`w-4 h-4 ${product.is_featured ? 'fill-[#FF5500]' : ''}`} />
                    </button>
                  </td>
                  <td className="py-3 px-5 text-center">
                    <button
                      onClick={() => handleToggle(product.id, 'is_active', product.is_active)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        product.is_active
                          ? 'text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/60'
                          : 'text-neutral-600 hover:text-neutral-400'
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
                  <td className="py-3 px-5 text-right space-x-1.5">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="inline-flex p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#1C1C28] transition-colors"
                      title="Edit product"
                    >
                      <Edit2 className="w-4 h-4 text-[#FF5500]" />
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id, product.title)}
                      className="inline-flex p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-[#1C1C28] transition-colors"
                      title="Delete product"
                    >
                      <Trash2 className="w-4 h-4" />
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

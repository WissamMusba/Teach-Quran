'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw, Filter } from 'lucide-react';

const CATEGORIES = [
  { label: 'All Categories', value: 'all' },
  { label: 'Cricket Bats', value: 'bats' },
  { label: 'Leather Balls', value: 'balls' },
  { label: 'Batting Pads', value: 'pads' },
  { label: 'Batting Gloves', value: 'gloves' },
  { label: 'Helmets', value: 'helmets' },
  { label: 'Kit Bags', value: 'bags' },
  { label: 'Cricket Shoes', value: 'shoes' },
];

const BRANDS = [
  { label: 'All Brands', value: 'all' },
  { label: 'Kookaburra', value: 'Kookaburra' },
  { label: 'Gray-Nicolls', value: 'Gray-Nicolls' },
  { label: 'SG', value: 'SG' },
  { label: 'SS', value: 'SS' },
  { label: 'MRF', value: 'MRF' },
  { label: 'Masuri', value: 'Masuri' },
  { label: 'Asics', value: 'Asics' },
];

export const ShopFilter: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get('category') || 'all';
  const currentBrand = searchParams.get('brand') || 'all';
  const currentSort = searchParams.get('sort') || 'newest';
  const currentSearch = searchParams.get('q') || '';

  const updateParam = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all' || !val) {
      params.delete(key);
    } else {
      params.set(key, val);
    }
    router.push(`/shop?${params.toString()}`);
  };

  const handleReset = () => {
    router.push('/shop');
  };

  const hasActiveFilters = currentCategory !== 'all' || currentBrand !== 'all' || currentSort !== 'newest' || currentSearch;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-6 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <div className="flex items-center space-x-2 text-sm font-bold text-neutral-900">
          <Filter className="w-4 h-4 text-orange-600" />
          <span>Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex items-center space-x-1 text-xs text-neutral-500 hover:text-orange-600 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div>
        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
          Search Equipment
        </label>
        <input
          type="text"
          value={currentSearch}
          onChange={(e) => updateParam('q', e.target.value)}
          placeholder="e.g. Kahuna, SG Test, Gloves..."
          className="w-full text-sm px-3.5 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      {/* Categories */}
      <div>
        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
          Category
        </label>
        <div className="space-y-1">
          {CATEGORIES.map((cat) => {
            const active = currentCategory.toLowerCase() === cat.value.toLowerCase();
            return (
              <button
                key={cat.value}
                onClick={() => updateParam('category', cat.value)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  active
                    ? 'bg-orange-50 font-bold text-orange-600'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 font-medium'
                }`}
              >
                <span>{cat.label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brands */}
      <div>
        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
          Brand
        </label>
        <div className="space-y-1">
          {BRANDS.map((b) => {
            const active = currentBrand.toLowerCase() === b.value.toLowerCase();
            return (
              <button
                key={b.value}
                onClick={() => updateParam('brand', b.value)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  active
                    ? 'bg-orange-50 font-bold text-orange-600'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 font-medium'
                }`}
              >
                <span>{b.label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sorting */}
      <div>
        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
          Sort By
        </label>
        <select
          value={currentSort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        >
          <option value="newest">Newest Arrivals</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
};

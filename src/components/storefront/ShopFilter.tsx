'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw, Filter, Search } from 'lucide-react';

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

interface ShopFilterProps {
  availableBrands?: string[];
}

const DEFAULT_BRANDS = [
  'SG',
  'SS',
  'Kookaburra',
  'Gray-Nicolls',
  'MRF',
  'Masuri',
  'Asics',
  'New Balance',
  'DSC',
  'CA',
];

export const ShopFilter: React.FC<ShopFilterProps> = ({ availableBrands }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const brandList = React.useMemo(() => {
    const set = new Set([...(availableBrands || []), ...DEFAULT_BRANDS]);
    return [
      { label: 'All Brands', value: 'all' },
      ...Array.from(set).map((b) => ({ label: b, value: b })),
    ];
  }, [availableBrands]);

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

  const hasActiveFilters =
    currentCategory !== 'all' || currentBrand !== 'all' || currentSort !== 'newest' || currentSearch;

  return (
    <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-6 space-y-6 shadow-sm dark:shadow-xl sticky top-28 transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-[#1C1C24]">
        <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-black dark:text-white">
          <Filter className="w-4 h-4 text-[#FF5500]" />
          <span>Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex items-center space-x-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500 hover:text-[#FF5500] dark:text-neutral-400 dark:hover:text-[#FF5500] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div>
        <label className="block text-[11px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-400 mb-2">
          Search Gear
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={currentSearch}
            onChange={(e) => updateParam('q', e.target.value)}
            placeholder="e.g. Kahuna, Ton Master..."
            className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500]/30 transition-colors"
          />
        </div>
      </div>

      {/* Categories */}
      <div>
        <label className="block text-[11px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-400 mb-2">
          Category
        </label>
        <div className="space-y-1">
          {CATEGORIES.map((cat) => {
            const active = currentCategory.toLowerCase() === cat.value.toLowerCase();
            return (
              <button
                key={cat.value}
                onClick={() => updateParam('category', cat.value)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                  active
                    ? 'bg-[#FF5500] text-white shadow-orange-glow-sm'
                    : 'text-neutral-700 dark:text-neutral-400 hover:bg-neutral-100 hover:text-black dark:hover:bg-[#15151D] dark:hover:text-white'
                }`}
              >
                <span>{cat.label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brands */}
      <div>
        <label className="block text-[11px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-400 mb-2">
          Authorized Brand
        </label>
        <div className="space-y-1">
          {brandList.map((b) => {
            const active = currentBrand.toLowerCase() === b.value.toLowerCase();
            return (
              <button
                key={b.value}
                onClick={() => updateParam('brand', b.value)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                  active
                    ? 'bg-[#FF5500] text-white shadow-orange-glow-sm'
                    : 'text-neutral-700 dark:text-neutral-400 hover:bg-neutral-100 hover:text-black dark:hover:bg-[#15151D] dark:hover:text-white'
                }`}
              >
                <span>{b.label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sorting */}
      <div>
        <label className="block text-[11px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-400 mb-2">
          Sort by Price
        </label>
        <select
          value={currentSort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white focus:outline-none focus:border-[#FF5500] font-bold uppercase tracking-wider"
        >
          <option value="newest">Newest Arrivals</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
};

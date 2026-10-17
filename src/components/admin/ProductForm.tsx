'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/lib/types';
import { ImageDropzone } from './ImageDropzone';
import { Loader2, ArrowLeft, Save, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface ProductFormProps {
  initialData?: Product;
  isEditing?: boolean;
}

const CATEGORIES = ['bats', 'balls', 'pads', 'gloves', 'helmets', 'bags', 'shoes'];
const POPULAR_BRANDS = [
  'SG',
  'SS',
  'Kookaburra',
  'Gray-Nicolls',
  'MRF',
  'New Balance',
  'Masuri',
  'DSC',
  'CA',
  'Puma',
  'Spartan',
];

export const ProductForm: React.FC<ProductFormProps> = ({ initialData, isEditing = false }) => {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [category, setCategory] = useState(initialData?.category || 'bats');
  const [brand, setBrand] = useState(initialData?.brand || 'SG');
  const [description, setDescription] = useState(initialData?.description || '');
  const [price, setPrice] = useState(initialData?.price ? String(initialData.price) : '');
  const [stockQuantity, setStockQuantity] = useState(
    initialData?.stock_quantity !== undefined ? String(initialData.stock_quantity) : '10'
  );
  const [images, setImages] = useState<string[]>(initialData?.images || []);
  const [isFeatured, setIsFeatured] = useState<boolean>(initialData?.is_featured || false);
  const [isActive, setIsActive] = useState<boolean>(
    initialData?.is_active !== undefined ? initialData.is_active : true
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    // Auto-generate slug on title change
    setSlug(slugify(val));
  };

  const handleRegenerateSlug = () => {
    setSlug(slugify(title));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        slug: (slug.trim() || slugify(title)),
        category,
        brand: brand.trim(),
        description: description.trim() || null,
        price: parseFloat(price) || 0,
        stock_quantity: parseInt(stockQuantity, 10) || 0,
        images,
        specifications: {},
        is_featured: isFeatured,
        is_active: isActive,
      };

      const url =
        isEditing && initialData?.id
          ? `/api/admin/products/${initialData.id}`
          : '/api/admin/products';

      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product');
      }

      router.push('/admin/products');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl text-white">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-6 border-b border-[#1C1C24] gap-4">
        <Link
          href="/admin/products"
          className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-neutral-400 hover:text-[#FF5500] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black text-xs uppercase tracking-wider transition-all shadow-orange-glow active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-black" />
              <span>{isEditing ? 'Save Changes' : 'Publish Gear'}</span>
            </>
          )}
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* 1. General Product Details */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-5 sm:p-7 shadow-xl space-y-5">
        <h3 className="font-display uppercase text-2xl font-black text-white border-b border-[#1C1C24] pb-3">
          1. General Product Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Product Title */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Product Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. SG Sunny Tonny Classic English Willow Cricket Bat"
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
            />
          </div>

          {/* URL Slug with Auto-generate */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-300">
                URL Slug *
              </label>
              <button
                type="button"
                onClick={handleRegenerateSlug}
                className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#FF5500] hover:text-[#FF6600]"
                title="Auto-generate slug from title"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Generate</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="sg-sunny-tonny-classic"
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#101016] text-[#FF5500] font-mono focus:outline-none focus:border-[#FF5500] transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white focus:outline-none focus:border-[#FF5500] font-bold uppercase tracking-wider"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Brand / Manufacturer */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-300">
                Brand / Manufacturer * (Custom Allowed)
              </label>
              <span className="text-[10px] text-neutral-500 uppercase font-bold">
                Type any brand or pick below
              </span>
            </div>
            <input
              type="text"
              required
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. SG, SS, Spartan, CA, CEAT, or any custom brand..."
              list="brand-suggestions"
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors font-bold"
            />
            <datalist id="brand-suggestions">
              {POPULAR_BRANDS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>

            {/* Quick-select brand pills */}
            <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mr-1">
                Quick Presets:
              </span>
              {POPULAR_BRANDS.map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition-all ${
                    brand.toLowerCase() === b.toLowerCase()
                      ? 'border-[#FF5500] bg-[#FF5500]/20 text-[#FF5500]'
                      : 'border-[#262630] bg-[#121218] text-neutral-400 hover:text-white hover:border-neutral-500'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Standard Price in AED */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Standard Price (AED) * (Strictly Non-Discount)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-500">
                AED
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1499.00"
                className="w-full text-xs pl-12 pr-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white font-mono text-sm focus:outline-none focus:border-[#FF5500] transition-colors"
              />
            </div>
          </div>

          {/* Stock Quantity */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Stock Quantity *
            </label>
            <input
              type="number"
              min="0"
              required
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              placeholder="15"
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white font-mono text-sm focus:outline-none focus:border-[#FF5500] transition-colors"
            />
          </div>

          {/* Description - Optional */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-300">
                Description <span className="text-neutral-500 font-normal">(Optional)</span>
              </label>
              <span className="text-[10px] text-neutral-500 uppercase font-bold">Not required</span>
            </div>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional: Describe craftsmanship, willow grade, profile, balance, and match performance characteristics..."
              className="w-full text-xs p-4 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 2. Product Images (Camera Snapshot, Mobile Upload, Drag & Drop, URL) */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-5 sm:p-7 shadow-xl space-y-5">
        <h3 className="font-display uppercase text-2xl font-black text-white border-b border-[#1C1C24] pb-3">
          2. Product Images (Camera, Upload or URL)
        </h3>
        <ImageDropzone images={images} onChange={setImages} />
      </div>

      {/* 3. Merchandising & Visibility */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-5 sm:p-7 shadow-xl space-y-5">
        <h3 className="font-display uppercase text-2xl font-black text-white border-b border-[#1C1C24] pb-3">
          3. Merchandising & Visibility
        </h3>

        <div className="space-y-4">
          <label className="flex items-start sm:items-center space-x-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-5 h-5 mt-0.5 sm:mt-0 text-[#FF5500] rounded border-[#272730] focus:ring-[#FF5500] bg-[#14141B] accent-[#FF5500]"
            />
            <div>
              <span className="text-sm font-bold text-white uppercase tracking-wide">
                Featured on Homepage
              </span>
              <p className="text-xs text-neutral-400">
                Promotes this equipment directly to the storefront showcase and homepage grid.
              </p>
            </div>
          </label>

          <label className="flex items-start sm:items-center space-x-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 mt-0.5 sm:mt-0 text-[#FF5500] rounded border-[#272730] focus:ring-[#FF5500] bg-[#14141B] accent-[#FF5500]"
            />
            <div>
              <span className="text-sm font-bold text-white uppercase tracking-wide">
                Active (Visible in Storefront)
              </span>
              <p className="text-xs text-neutral-400">
                When unchecked, customers cannot browse or purchase this item.
              </p>
            </div>
          </label>
        </div>
      </div>
    </form>
  );
};

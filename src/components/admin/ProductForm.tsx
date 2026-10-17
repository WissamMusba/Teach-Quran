'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/lib/types';
import { ImageDropzone } from './ImageDropzone';
import { Loader2, Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

interface ProductFormProps {
  initialData?: Product;
  isEditing?: boolean;
}

const CATEGORIES = ['bats', 'balls', 'pads', 'gloves', 'helmets', 'bags', 'shoes'];
const BRANDS = ['Kookaburra', 'Gray-Nicolls', 'SG', 'SS', 'MRF', 'Masuri', 'Asics', 'New Balance'];

export const ProductForm: React.FC<ProductFormProps> = ({ initialData, isEditing = false }) => {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [category, setCategory] = useState(initialData?.category || 'bats');
  const [brand, setBrand] = useState(initialData?.brand || 'Kookaburra');
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

  const [specs, setSpecs] = useState<{ key: string; value: string }[]>(
    initialData?.specifications && Object.keys(initialData.specifications).length > 0
      ? Object.entries(initialData.specifications).map(([k, v]) => ({ key: k, value: String(v) }))
      : [
          { key: 'willow', value: 'English Grade 1' },
          { key: 'weight', value: '2lb 8oz' },
          { key: 'handle', value: 'Short Handle' },
        ]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!isEditing && (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      );
    }
  };

  const handleAddSpec = () => {
    setSpecs((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleSpecChange = (index: number, field: 'key' | 'value', value: string) => {
    setSpecs((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleRemoveSpec = (index: number) => {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const formattedSpecs: Record<string, string> = {};
      specs.forEach((s) => {
        if (s.key.trim()) {
          formattedSpecs[s.key.trim()] = s.value.trim();
        }
      });

      const payload = {
        title,
        slug,
        category,
        brand,
        description,
        price: parseFloat(price) || 0,
        stock_quantity: parseInt(stockQuantity, 10) || 0,
        images,
        specifications: formattedSpecs,
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
      <div className="flex items-center justify-between pb-6 border-b border-[#1C1C24]">
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

      {/* Basic Info */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-7 shadow-xl space-y-5">
        <h3 className="font-display uppercase text-2xl font-black text-white border-b border-[#1C1C24] pb-3">
          1. General Product Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Product Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. Kookaburra Kahuna Pro English Willow Cricket Bat"
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              URL Slug *
            </label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="kookaburra-kahuna-pro"
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#101016] text-[#FF5500] font-mono focus:outline-none focus:border-[#FF5500] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Brand / Manufacturer *
            </label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white focus:outline-none focus:border-[#FF5500] font-bold"
            >
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

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

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Standard Price ($ USD) * (Strictly Non-Discount)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="499.00"
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white font-mono text-sm focus:outline-none focus:border-[#FF5500] transition-colors"
            />
          </div>

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

          <div className="sm:col-span-2">
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe craftsmanship, willow grade, profile, balance, and match performance characteristics..."
              className="w-full text-xs p-4 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Image Uploader */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-7 shadow-xl space-y-5">
        <h3 className="font-display uppercase text-2xl font-black text-white border-b border-[#1C1C24] pb-3">
          2. Product Images (Supabase: product-media)
        </h3>
        <ImageDropzone images={images} onChange={setImages} />
      </div>

      {/* Specifications */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-7 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#1C1C24] pb-3">
          <h3 className="font-display uppercase text-2xl font-black text-white">
            3. Technical Specifications
          </h3>
          <button
            type="button"
            onClick={handleAddSpec}
            className="inline-flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider text-[#FF5500] hover:text-[#FF6600]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Spec</span>
          </button>
        </div>

        <div className="space-y-3">
          {specs.map((item, index) => (
            <div key={index} className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Key (e.g. willow, weight, handle)"
                value={item.key}
                onChange={(e) => handleSpecChange(index, 'key', e.target.value)}
                className="w-1/3 text-xs px-3.5 py-2.5 rounded-xl border border-[#272730] bg-[#14141B] text-white font-mono"
              />
              <input
                type="text"
                placeholder="Value (e.g. English Grade 1, 2lb 8oz)"
                value={item.value}
                onChange={(e) => handleSpecChange(index, 'value', e.target.value)}
                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-[#272730] bg-[#14141B] text-white"
              />
              <button
                type="button"
                onClick={() => handleRemoveSpec(index)}
                className="text-neutral-500 hover:text-red-400 p-2 transition-colors"
                title="Remove spec"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Visibility & Toggles */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-7 shadow-xl space-y-5">
        <h3 className="font-display uppercase text-2xl font-black text-white border-b border-[#1C1C24] pb-3">
          4. Merchandising & Visibility
        </h3>

        <div className="space-y-4">
          <label className="flex items-center space-x-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-5 h-5 text-[#FF5500] rounded border-[#272730] focus:ring-[#FF5500] bg-[#14141B]"
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

          <label className="flex items-center space-x-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 text-[#FF5500] rounded border-[#272730] focus:ring-[#FF5500] bg-[#14141B]"
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

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Truck, CreditCard, Sparkles } from 'lucide-react';
import { SiteSettings, Product } from '@/lib/types';

interface HeroBannerProps {
  settings: SiteSettings;
  spotlightProduct?: Product;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ settings, spotlightProduct }) => {
  const headline = settings.hero_headline || 'Pro Cricket Equipment & Match Gear';
  const subheadline =
    settings.hero_subheadline ||
    'Grade 1 English Willow bats, leather balls, and protective gear from SG, SS, Kookaburra & Gray-Nicolls. Fast delivery across Ajman and all UAE Emirates.';

  return (
    <div className="relative overflow-hidden bg-neutral-100/70 dark:bg-[#07070A] border-b border-neutral-200 dark:border-[#1C1C24] transition-colors duration-200">
      {/* Subtle ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FF5500]/10 dark:bg-[#FF5500]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#FF5500]/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Clean Title, Description & CTAs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Academy Location Pill */}
            <div className="inline-flex items-center space-x-2 bg-white dark:bg-[#121218] border border-neutral-200 dark:border-[#262632] px-3.5 py-1.5 rounded-full text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#FF5500] animate-pulse" />
              <span className="uppercase tracking-wider font-extrabold text-[11px]">
                Seven Districts Cricket Academy • Ajman, UAE
              </span>
            </div>

            {/* Clean, perfectly-scaled Headline (not oversized) */}
            <h1 className="font-display uppercase text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-neutral-950 dark:text-white leading-[1.08]">
              {headline}
            </h1>

            {/* Subheadline with readable contrast */}
            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 font-medium leading-relaxed max-w-xl">
              {subheadline}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/shop"
                className="inline-flex items-center space-x-2.5 px-6 py-3.5 rounded-xl bg-[#FF5500] hover:bg-[#E04B00] text-white font-black uppercase tracking-wider text-xs transition-all duration-200 shadow-orange-glow active:scale-95 group"
              >
                <span>Shop All Gear</span>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/shop?category=bats"
                className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-950 border border-neutral-300 dark:bg-[#121218] dark:hover:bg-[#1A1A22] dark:text-white dark:border-[#282834] font-black uppercase tracking-wider text-xs transition-all shadow-sm active:scale-95"
              >
                <span>English Willow Bats</span>
              </Link>
            </div>

            {/* Trust Badges Strip */}
            <div className="pt-4 border-t border-neutral-200 dark:border-[#1E1E26] flex flex-wrap gap-y-2 gap-x-6 text-xs text-neutral-600 dark:text-neutral-400 font-bold">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-[#FF5500]" />
                <span>100% Genuine Brands</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Truck className="w-4 h-4 text-[#FF5500]" />
                <span>Fast UAE Dispatch</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CreditCard className="w-4 h-4 text-[#FF5500]" />
                <span>Card &amp; Cash on Delivery</span>
              </div>
            </div>
          </div>

          {/* Right Column: Featured Product Showcase Card */}
          <div className="lg:col-span-5">
            {spotlightProduct ? (
              <div className="relative group">
                {/* Outer Glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#FF5500]/20 to-orange-500/0 rounded-3xl blur-xl group-hover:from-[#FF5500]/30 transition-all duration-500" />
                
                <div className="relative bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-6 sm:p-7 shadow-xl group-hover:border-[#FF5500]/60 transition-all duration-300">
                  {/* Top Bar with Badge & Brand */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-wider bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] px-3 py-1 rounded-full">
                      <Sparkles className="w-3 h-3 text-[#FF5500]" />
                      <span>Academy Pick</span>
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {spotlightProduct.brand}
                    </span>
                  </div>

                  {/* Product Image Stage */}
                  <Link
                    href={`/product/${spotlightProduct.slug}`}
                    className="block relative h-52 sm:h-56 bg-neutral-50 dark:bg-[#14141B] rounded-2xl border border-neutral-200/80 dark:border-[#20202A] p-4 overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={spotlightProduct.images[0]}
                      alt={spotlightProduct.title}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  </Link>

                  {/* Product Information & Price */}
                  <div className="mt-5 space-y-3">
                    <div>
                      <Link
                        href={`/product/${spotlightProduct.slug}`}
                        className="font-display uppercase text-lg sm:text-xl font-black text-neutral-950 dark:text-white group-hover:text-[#FF5500] transition-colors line-clamp-1 block"
                      >
                        {spotlightProduct.title}
                      </Link>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-0.5 line-clamp-1">
                        {spotlightProduct.category === 'bats'
                          ? 'Grade 1 English Willow • Match Profile'
                          : 'Tournament Match Specification'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-neutral-100 dark:border-[#1C1C24] flex items-center justify-between">
                      <div className="flex items-baseline space-x-1">
                        <span className="text-xs font-black text-[#FF5500]">AED</span>
                        <span className="font-display text-2xl font-black text-neutral-950 dark:text-white">
                          {spotlightProduct.price.toLocaleString()}
                        </span>
                      </div>

                      <Link
                        href={`/product/${spotlightProduct.slug}`}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-neutral-950 hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-black text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                      >
                        <span>View Gear</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-8 shadow-xl text-center space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-[#FF5500]">
                  Authorized Brands
                </span>
                <div className="flex flex-wrap justify-center gap-3">
                  {['Kookaburra', 'Gray-Nicolls', 'SG', 'SS', 'MRF'].map((b) => (
                    <span
                      key={b}
                      className="px-3.5 py-1.5 rounded-xl bg-neutral-100 dark:bg-[#181822] text-xs font-bold text-neutral-800 dark:text-neutral-200"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Category Jump Bar */}
        <div className="mt-10 pt-6 border-t border-neutral-200/80 dark:border-[#1C1C24] flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 dark:text-neutral-500 shrink-0 mr-2">
            Quick Categories:
          </span>
          {[
            { label: 'All Equipment', href: '/shop' },
            { label: 'English Willow Bats', href: '/shop?category=bats' },
            { label: 'Match Balls', href: '/shop?category=balls' },
            { label: 'Batting Pads', href: '/shop?category=pads' },
            { label: 'Gloves', href: '/shop?category=gloves' },
            { label: 'Helmets', href: '/shop?category=helmets' },
            { label: 'Kit Bags', href: '/shop?category=bags' },
          ].map((cat) => (
            <Link
              key={cat.label}
              href={cat.href}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white dark:bg-[#121218] border border-neutral-200 dark:border-[#252530] hover:border-[#FF5500] dark:hover:border-[#FF5500] text-neutral-700 dark:text-neutral-300 hover:text-[#FF5500] dark:hover:text-[#FF5500] text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

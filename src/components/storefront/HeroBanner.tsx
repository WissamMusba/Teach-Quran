import React from 'react';
import Link from 'next/link';
import { ArrowRight, Zap, Shield, Flame } from 'lucide-react';
import { SiteSettings } from '@/lib/types';

interface HeroBannerProps {
  settings: SiteSettings;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ settings }) => {
  const bgImage =
    settings.hero_banner_image ||
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop';

  return (
    <div className="relative overflow-hidden bg-[#050505] border-b border-[#1C1C22]">
      {/* Background Graphic / Image Overlay with deep black gradient */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-screen scale-105 transition-transform duration-1000"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      
      {/* Laser Gradient Vignettes */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/60" />

      {/* Radiant Orange Glow Spot */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#FF5500]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
        <div className="max-w-3xl space-y-7">
          {/* Tagline Badge */}
          <div className="inline-flex items-center space-x-2 bg-[#FF5500]/10 border border-[#FF5500]/40 text-[#FF5500] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-orange-glow-sm">
            <Flame className="w-4 h-4 text-[#FF5500] fill-[#FF5500]" />
            <span>2026 International Match Specifications</span>
          </div>

          {/* Headline in Barlow Condensed / Athletic style */}
          <h1 className="font-display uppercase text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white leading-[0.92] drop-shadow-md">
            {settings.hero_headline}
          </h1>

          {/* Subheadline in crisp neutral-300 */}
          <p className="text-base sm:text-lg text-neutral-300 font-medium leading-relaxed max-w-2xl">
            {settings.hero_subheadline}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 pt-3">
            <Link
              href="/shop"
              className="inline-flex items-center space-x-3 px-8 py-4 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-wider text-sm transition-all duration-200 shadow-orange-glow active:scale-95 group"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/shop?category=bats"
              className="inline-flex items-center space-x-2 px-8 py-4 rounded-xl bg-[#121217] hover:bg-[#1C1C24] text-white border border-[#2E2E38] hover:border-neutral-400 font-bold uppercase tracking-wider text-sm transition-all"
            >
              <span>English Willow Bats</span>
            </Link>
          </div>

          {/* Athletic Trust Metrics */}
          <div className="pt-8 border-t border-[#1C1C24] grid grid-cols-3 gap-6 max-w-lg">
            <div className="space-y-0.5">
              <span className="block font-display uppercase font-black text-2xl text-white tracking-wide">
                Grade 1
              </span>
              <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">
                English Willow
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="block font-display uppercase font-black text-2xl text-white tracking-wide">
                100%
              </span>
              <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">
                Authorized Stock
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="block font-display uppercase font-black text-2xl text-[#FF5500] tracking-wide">
                Fast Courier
              </span>
              <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">
                Card & COD
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

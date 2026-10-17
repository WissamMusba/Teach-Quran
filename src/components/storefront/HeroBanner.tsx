import React from 'react';
import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';
import { SiteSettings } from '@/lib/types';

interface HeroBannerProps {
  settings: SiteSettings;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ settings }) => {
  const bgImage =
    settings.hero_banner_image ||
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop';

  return (
    <div className="relative overflow-hidden bg-neutral-900 border-b border-neutral-200">
      {/* Background Graphic / Image Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity scale-105 transition-transform duration-1000"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center space-x-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide">
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span>2026 International Match Specifications</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
            {settings.hero_headline}
          </h1>

          <p className="text-base sm:text-lg text-neutral-300 font-normal leading-relaxed">
            {settings.hero_subheadline}
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <Link
              href="/shop"
              className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-95"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/shop?category=bats"
              className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold text-sm transition-all"
            >
              <span>English Willow Bats</span>
            </Link>
          </div>

          {/* Quick stats / reassurance */}
          <div className="pt-6 border-t border-neutral-800 grid grid-cols-3 gap-4 text-neutral-400 text-xs">
            <div>
              <span className="block text-white font-bold text-lg">Grade 1</span>
              <span>English Willow</span>
            </div>
            <div>
              <span className="block text-white font-bold text-lg">100%</span>
              <span>Authentic Gear</span>
            </div>
            <div>
              <span className="block text-white font-bold text-lg">Card & COD</span>
              <span>Secure Payments</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

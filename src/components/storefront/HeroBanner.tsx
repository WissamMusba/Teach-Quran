'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ArrowRight,
  ShieldCheck,
  Truck,
  Building2,
  Shield,
  Hand,
  HardHat,
  Backpack,
} from 'lucide-react';
import { CricketBatIcon, CricketBallIcon } from '@/components/storefront/icons';
import { buildHeroSlides, type HeroSlide } from '@/lib/heroSlides';
import { SiteSettings, Product } from '@/lib/types';

interface HeroBannerProps {
  settings: SiteSettings;
  spotlightProduct?: Product;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ settings }) => {
  const slides: HeroSlide[] = buildHeroSlides(settings);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx);
  };

  // Autoplay effect
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      nextSlide();
    }, 5500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, nextSlide]);

  // Touch swipe support
  const minSwipeDistance = 50;
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  const activeSlide = slides[currentIndex];

  return (
    <div className="relative bg-black text-white overflow-hidden select-none">
      {/* Slideshow Canvas */}
      <div
        className="relative h-[480px] sm:h-[540px] lg:h-[620px] w-full group overflow-hidden"
        onMouseEnter={() => setIsPlaying(false)}
        onMouseLeave={() => setIsPlaying(true)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Slide Images (Stacked for smooth crossfade transition) */}
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Background Photographic Image with gentle Ken Burns zoom */}
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                priority={index === 0}
                loading={index === 0 ? 'eager' : 'lazy'}
                sizes="100vw"
                quality={85}
                className={`object-cover object-center transform transition-transform duration-[6000ms] ease-out will-change-transform ${
                  isActive ? 'scale-105' : 'scale-100'
                }`}
              />

              {/* Pro:Direct Cinematic Dark Gradients for optimal readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/20" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-transparent" />
            </div>
          );
        })}

        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-[#FF5500]/15 rounded-full blur-3xl pointer-events-none z-10" />

        {/* Floating Price/Feature Tag on Desktop Top-Right */}
        {activeSlide.priceBadge && (
          <div key={activeSlide.id} className="absolute top-8 right-8 z-20 hidden md:block animate-fade-in">
            <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3 shadow-2xl text-right">
              <span className="block text-[10px] font-black uppercase tracking-widest text-[#FF5500]">
                Official Academy Spec
              </span>
              <span className="block font-display text-lg sm:text-xl font-black text-white tracking-wide">
                {activeSlide.priceBadge}
              </span>
            </div>
          </div>
        )}

        {/* Left / Right Chevron Controls */}
        <button
          onClick={prevSlide}
          aria-label="Previous Slide"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-[#FF5500] text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-md shadow-lg active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={nextSlide}
          aria-label="Next Slide"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-[#FF5500] text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-md shadow-lg active:scale-95"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Main Content Overlay: Bottom-Left (Pro:Direct Style) */}
        <div className="absolute inset-0 z-20 flex flex-col justify-end">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14">
            <div className="max-w-3xl space-y-4">
              
              {/* Pro:Direct Style Indicators: Dots + Pause/Play */}
              <div className="flex items-center space-x-2.5 pb-1">
                <div className="flex items-center space-x-2">
                  {slides.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => goToSlide(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === currentIndex
                          ? 'w-7 bg-[#FF5500] shadow-orange-glow-sm'
                          : 'w-2 bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>

                {/* Pause / Play Toggle */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
                  className="p-1 rounded-full text-white/70 hover:text-white transition-colors ml-1"
                  title={isPlaying ? 'Pause auto-rotation' : 'Play auto-rotation'}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                </button>
              </div>

              {/* Tagline */}
              <div className="font-display italic uppercase tracking-wider text-xs sm:text-sm font-bold text-neutral-300 flex items-center space-x-2">
                <span className="text-[#FF5500] not-italic font-black text-sm">{'///'}</span>
                <span>{activeSlide.tagline}</span>
              </div>

              {/* Headline (Crisp, atmospheric, Pro:Direct aesthetic) */}
              <h1 className="font-display uppercase text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[0.98] drop-shadow-md">
                {activeSlide.title}
              </h1>

              {/* Subtitle */}
              <p className="text-xs sm:text-sm lg:text-base text-neutral-200 font-medium leading-relaxed max-w-2xl drop-shadow-sm">
                {activeSlide.subtitle}
              </p>

              {/* Frosted Pill Buttons (Pro:Direct Signature Style) */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                {/* Primary Button */}
                <Link
                  href={activeSlide.primaryCta.href}
                  className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-[#FF5500] hover:bg-[#FF6600] text-white font-black uppercase tracking-wider text-xs transition-all duration-200 shadow-orange-glow active:scale-95"
                >
                  <span>{activeSlide.primaryCta.label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                {/* Frosted Secondary Pill Buttons */}
                {activeSlide.secondaryCtas.map((cta) => (
                  <Link
                    key={cta.label}
                    href={cta.href}
                    className="inline-flex items-center px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-md border border-white/25 text-white font-black uppercase tracking-wider text-xs transition-all duration-200 active:scale-95 shadow-sm"
                  >
                    {cta.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Category Navigation Strip under Slideshow */}
      <div className="border-t border-neutral-800 bg-[#09090D] py-3.5 px-4 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 shrink-0 mr-1 hidden sm:inline">
              Shop Categories:
            </span>
            {[
              { label: 'Bats', href: '/shop?category=bats', Icon: CricketBatIcon },
              { label: 'Match Balls', href: '/shop?category=balls', Icon: CricketBallIcon },
              { label: 'Pads', href: '/shop?category=pads', Icon: Shield },
              { label: 'Gloves', href: '/shop?category=gloves', Icon: Hand },
              { label: 'Helmets', href: '/shop?category=helmets', Icon: HardHat },
              { label: 'Kit Bags', href: '/shop?category=bags', Icon: Backpack },
            ].map((cat) => (
              <Link
                key={cat.label}
                href={cat.href}
                className="grow-0 shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#14141B] hover:bg-[#1E1E28] border border-[#272734] hover:border-[#FF5500] text-neutral-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <cat.Icon className="w-3.5 h-3.5 text-[#FF5500]" aria-hidden="true" />
                <span>{cat.label}</span>
              </Link>
            ))}
          </div>

          {/* Quick Trust Highlights */}
          <div className="hidden lg:flex items-center space-x-6 text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF5500]" />
              <span>100% Authentic Brands</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Truck className="w-3.5 h-3.5 text-[#FF5500]" />
              <span>Fast UAE Dispatch</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#FF5500]" />
              <span>Bank Transfer &amp; COD</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

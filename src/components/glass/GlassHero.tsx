'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { buildHeroSlides } from '@/lib/heroSlides';
import type { SiteSettings } from '@/lib/types';

interface GlassHeroProps {
  settings: SiteSettings;
}

const TRUST_ROWS = [
  { icon: Truck, text: 'Fast UAE Dispatch' },
  { icon: ShieldCheck, text: '100% Authentic Brands' },
  { icon: Banknote, text: 'Card & Cash on Delivery' },
];

/**
 * Liquid Glass hero — full-bleed photography under a frosted spec panel.
 * Text sits on the darkened image itself, so it stays light in both themes.
 */
export const GlassHero: React.FC<GlassHeroProps> = ({ settings }) => {
  const slides = buildHeroSlides(settings);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const next = useCallback(() => setIndex((p) => (p + 1) % slides.length), [slides.length]);
  const prev = useCallback(
    () => setIndex((p) => (p - 1 + slides.length) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(next, 6500);
    return () => clearInterval(timer);
  }, [playing, next]);

  const active = slides[index];

  const handleTouchEnd = () => {
    if (touchStart.current === null || touchEnd.current === null) return;
    const delta = touchStart.current - touchEnd.current;
    if (delta > 50) next();
    else if (delta < -50) prev();
  };

  return (
    <section
      aria-label="Academy equipment highlights"
      className="relative flex min-h-screen items-center overflow-hidden pb-24 pt-28 sm:pt-32"
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
      onTouchStart={(e) => {
        touchEnd.current = null;
        touchStart.current = e.targetTouches[0].clientX;
      }}
      onTouchMove={(e) => {
        touchEnd.current = e.targetTouches[0].clientX;
      }}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide imagery */}
      {slides.map((slide, i) => {
        const isActive = i === index;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${
              isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!isActive}
          >
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              priority={i === 0}
              loading={i === 0 ? 'eager' : 'lazy'}
              sizes="100vw"
              className={`object-cover object-center transition-transform duration-[7000ms] ease-out will-change-transform ${
                isActive ? 'scale-105' : 'scale-100'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/55 to-[#050506]/25" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050506]/85 via-[#050506]/35 to-transparent" />
          </div>
        );
      })}

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          {/* Headline block — keyed so it re-animates on slide change */}
          <div key={active.id} className="animate-fade-in space-y-6">
            <span className="glass-chip-dark px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white">
              <span className="text-[#FF5500]" aria-hidden="true">
                {'///'}
              </span>
              {active.tagline}
            </span>

            <h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
              {active.title}
            </h1>

            <p className="max-w-xl text-sm font-medium leading-relaxed text-white/80 sm:text-base">
              {active.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={active.primaryCta.href}
                className="btn-glass inline-flex items-center gap-2 rounded-full bg-[#FF5500] px-7 py-3 text-xs font-black uppercase tracking-wider text-black shadow-orange-glow transition-all duration-200 hover:bg-[#FF6B1A] active:scale-95"
              >
                {active.primaryCta.label}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              {active.secondaryCtas.map((cta) => (
                <Link
                  key={cta.label}
                  href={cta.href}
                  className="glass-chip-dark px-5 py-3 text-xs font-black uppercase tracking-wider text-white/90 transition-all duration-200 hover:bg-white/20 hover:text-white active:scale-95"
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Frosted spec card */}
          <div className="hidden lg:block">
            <div className="glass-dark glass-sheen rounded-3xl p-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF9A5C]">
                Official Academy Spec
              </span>
              <p className="mt-2 font-display text-2xl font-black uppercase tracking-wide text-white">
                {active.priceBadge}
              </p>
              <div className="mt-6 space-y-3">
                {TRUST_ROWS.map((row) => (
                  <div key={row.text} className="flex items-center gap-3">
                    <span className="glass-chip-dark h-9 w-9 items-center justify-center">
                      <row.icon className="h-4 w-4 text-[#FF5500]" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/85">
                      {row.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Slide controls */}
        <div className="mt-10 flex items-center gap-3">
          <button
            onClick={prev}
            aria-label="Previous slide"
            className="glass-chip-dark h-10 w-10 items-center justify-center text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            className="glass-chip-dark h-10 w-10 items-center justify-center text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2 px-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-8 bg-[#FF5500]' : 'w-4 bg-white/35 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
            className="glass-chip-dark h-10 w-10 items-center justify-center text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </section>
  );
};

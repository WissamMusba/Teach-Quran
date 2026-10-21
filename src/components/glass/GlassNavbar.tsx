'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { ThemeToggle } from '@/context/ThemeContext';
import { Menu, X, Search, ShoppingCart, Headphones, ArrowUpRight } from 'lucide-react';

const LINKS = [
  { label: 'All Gear', href: '/shop' },
  { label: 'Bats', href: '/shop?category=bats' },
  { label: 'Balls', href: '/shop?category=balls' },
  { label: 'Pads', href: '/shop?category=pads' },
  { label: 'Gloves', href: '/shop?category=gloves' },
  { label: 'Helmets', href: '/shop?category=helmets' },
  { label: 'Bags', href: '/shop?category=bags', wide: true },
  { label: 'Shoes', href: '/shop?category=shoes', wide: true },
];

/**
 * Floating Liquid Glass navigation pill. Densifies (glass-panel-strong)
 * once the page scrolls so it stays legible over photography.
 */
export const GlassNavbar: React.FC = () => {
  const { totalItems, setIsCartDrawerOpen } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkBase =
    'rounded-full px-3 py-2 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-colors';
  const linkIdle =
    'text-neutral-700 hover:bg-white/60 hover:text-black dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white';
  const linkActive = 'text-[#C2410C] dark:text-[#FF5500]';

  return (
    <header className="fixed inset-x-0 top-0 z-40 pt-3 sm:pt-4">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div
          className={`glass-panel rounded-2xl px-3 transition-all duration-300 sm:rounded-full sm:px-5 ${
            scrolled ? 'glass-panel-strong shadow-2xl' : ''
          }`}
        >
          <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
            {/* Brand */}
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                onClick={() => setOpen(!open)}
                className="rounded-full p-2 text-neutral-700 transition-colors hover:bg-white/60 hover:text-black dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <Link href="/" className="flex min-w-0 items-center gap-2.5">
                <Image
                  src="/logo-seven-districts.png"
                  alt="CG Sports"
                  width={36}
                  height={36}
                  priority
                  className="h-9 w-9 rounded-full border border-white/50 bg-white/60 object-contain p-0.5 dark:border-white/20 dark:bg-white/10"
                />
                <span className="flex min-w-0 flex-col leading-none">
                  <span className="font-display text-lg font-black uppercase tracking-tight text-black dark:text-white sm:text-xl">
                    CG Sports<span className="text-[#FF5500]">.</span>
                  </span>
                  <span className="hidden text-[9px] font-black uppercase tracking-[0.18em] text-neutral-500 dark:text-white/60 sm:block">
                    Located at Seven Districts • Ajman, UAE
                  </span>
                </span>
              </Link>
            </div>

            {/* Desktop links */}
            <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
              {LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`${linkBase} ${pathname === link.href ? linkActive : linkIdle} ${
                    link.wide ? 'hidden xl:inline-flex' : ''
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/shop"
                title="Search gear"
                className="hidden rounded-full p-2.5 text-neutral-700 transition-colors hover:bg-white/60 hover:text-black dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white sm:flex"
              >
                <Search className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="hidden items-center gap-1.5 rounded-full border border-white/60 bg-white/50 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-800 transition-colors hover:bg-white/80 dark:border-white/15 dark:bg-white/10 dark:text-white/85 dark:hover:bg-white/15 xl:inline-flex"
              >
                <Headphones className="h-3.5 w-3.5 text-[#FF5500]" />
                <span>Contact</span>
              </Link>
              <Link
                href="/classic"
                title="Switch to the athletic storefront design"
                className="hidden items-center gap-1.5 rounded-full border border-white/60 bg-white/50 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-800 transition-colors hover:bg-white/80 dark:border-white/15 dark:bg-white/10 dark:text-white/85 dark:hover:bg-white/15 xl:inline-flex"
              >
                <span>Classic</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[#FF5500]" />
              </Link>
              <ThemeToggle />
              <button
                onClick={() => setIsCartDrawerOpen(true)}
                className="relative rounded-full border border-white/60 bg-white/50 p-2.5 text-black transition-all hover:bg-white/80 active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                aria-label="Open cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF5500] px-1 text-[11px] font-black text-black shadow-orange-glow-sm animate-zoom-in">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile sheet */}
        {open && (
          <div className="glass-panel glass-panel-strong mt-2 rounded-2xl p-3 shadow-2xl lg:hidden">
            <div className="grid grid-cols-2 gap-1.5">
              {LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors ${
                    pathname === link.href
                      ? 'bg-[#FF5500] text-black'
                      : 'text-neutral-800 hover:bg-white/60 dark:text-white/85 dark:hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Link
              href="/classic"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/50 bg-white/40 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-neutral-800 transition-colors hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/85 dark:hover:bg-white/10"
            >
              <span>View Athletic Design</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#FF5500]" />
            </Link>
            <div className="mt-3 flex items-center justify-between border-t border-white/50 px-2 pt-3 dark:border-white/10">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500 dark:text-white/60">
                Display Mode
              </span>
              <ThemeToggle showLabel />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

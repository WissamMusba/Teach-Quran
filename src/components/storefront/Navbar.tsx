'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { ShoppingCart, Menu, X, Search, Headphones } from 'lucide-react';

const CATEGORIES = [
  { name: 'Bats', href: '/shop?category=bats' },
  { name: 'Balls', href: '/shop?category=balls' },
  { name: 'Pads', href: '/shop?category=pads' },
  { name: 'Gloves', href: '/shop?category=gloves' },
  { name: 'Helmets', href: '/shop?category=helmets' },
  { name: 'Bags', href: '/shop?category=bags' },
  { name: 'Shoes', href: '/shop?category=shoes' },
];

export const Navbar: React.FC = () => {
  const { totalItems, setIsCartDrawerOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-[#08080A]/95 backdrop-blur-md border-b border-[#1C1C22]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <Link href="/" className="flex items-center space-x-3 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-seven-districts.png"
                alt="Seven Districts Cricket Academy"
                className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-xl shrink-0 border border-[#2E2E38] bg-[#0A0A0E] p-0.5 group-hover:border-[#FF5500]/60 transition-colors"
              />
              <div className="flex flex-col">
                <span className="font-display text-xl sm:text-2xl font-black tracking-tight text-white uppercase leading-none group-hover:text-neutral-200 transition-colors">
                  SEVEN DISTRICTS<span className="text-[#FF5500]">.</span>
                </span>
                <span className="text-[9px] uppercase tracking-widest font-black text-neutral-400 font-sans mt-0.5">
                  CRICKET ACADEMY • AJMAN, UAE
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Category Navigation */}
          <nav className="hidden lg:flex items-center space-x-7">
            <Link
              href="/shop"
              className={`font-display uppercase tracking-wider text-base font-bold transition-all relative py-1 ${
                pathname === '/shop'
                  ? 'text-[#FF5500]'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              All Gear
              {pathname === '/shop' && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#FF5500] shadow-orange-glow-sm" />
              )}
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                className="font-display uppercase tracking-wider text-base font-bold text-neutral-400 hover:text-white hover:translate-y-[-1px] transition-all"
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link
              href="/shop"
              className="p-2.5 text-neutral-400 hover:text-white hover:bg-[#141418] rounded-xl border border-transparent hover:border-[#26262E] transition-all hidden sm:flex"
              title="Search Gear"
            >
              <Search className="w-4 h-4" />
            </Link>

            <Link
              href="/contact"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-[#26262E] bg-[#101014] text-xs font-bold uppercase tracking-wider text-neutral-300 hover:text-white hover:border-[#FF5500]/50 transition-colors"
              title="Contact Support"
            >
              <Headphones className="w-3.5 h-3.5 text-[#FF5500]" />
              <span>Contact</span>
            </Link>

            {/* Cart Trigger Button */}
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="relative p-2.5 rounded-xl bg-[#121217] hover:bg-[#181820] text-white border border-[#26262E] hover:border-[#FF5500]/60 transition-all active:scale-95 shadow-sm"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-5 h-5 text-white" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#FF5500] text-black font-black text-[11px] min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 shadow-orange-glow animate-in zoom-in-50 duration-200">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#1C1C22] bg-[#0A0A0E] px-4 pt-4 pb-6 space-y-4 shadow-2xl">
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-[#1C1C22]">
            <Link
              href="/shop"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center p-3 rounded-xl bg-[#FF5500] text-black font-black uppercase tracking-wider text-xs shadow-orange-glow-sm"
            >
              All Equipment
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center space-x-1.5 p-3 rounded-xl bg-[#14141A] border border-[#272730] text-neutral-200 font-bold text-xs"
            >
              <Headphones className="w-4 h-4 text-[#FF5500]" />
              <span>Contact Support</span>
            </Link>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-black px-2 block mb-2">
              Gear Departments
            </span>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg font-display uppercase tracking-wider text-lg font-bold text-neutral-300 hover:bg-[#15151C] hover:text-[#FF5500] transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { ShoppingCart, Menu, X, Shield, Search } from 'lucide-react';

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
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center font-black text-white text-base tracking-tighter">
                C<span className="text-orange-500">S</span>
              </div>
              <div className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 group-hover:text-neutral-700 transition-colors">
                CRICKET<span className="text-orange-600">STORE</span>
              </div>
            </Link>
          </div>

          {/* Desktop Category Navigation */}
          <nav className="hidden lg:flex items-center space-x-7">
            <Link
              href="/shop"
              className={`text-sm font-semibold tracking-wide transition-colors ${
                pathname === '/shop' ? 'text-orange-600' : 'text-neutral-800 hover:text-orange-600'
              }`}
            >
              All Gear
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                className="text-sm font-medium text-neutral-600 hover:text-orange-600 tracking-wide transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link
              href="/shop"
              className="p-2 text-neutral-600 hover:text-orange-600 hover:bg-neutral-100 rounded-full transition-colors hidden sm:flex"
              title="Search Catalog"
            >
              <Search className="w-5 h-5" />
            </Link>

            <Link
              href="/admin/dashboard"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition-colors"
              title="Admin Portal"
            >
              <Shield className="w-3.5 h-3.5 text-neutral-500" />
              <span>Admin</span>
            </Link>

            {/* Cart Trigger Button */}
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="relative p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-900 border border-neutral-200 transition-all active:scale-95"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-5 h-5 text-neutral-900" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-orange-600 text-white font-black text-[11px] min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 shadow-sm animate-in zoom-in-50 duration-200">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-neutral-100">
            <Link
              href="/shop"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center p-3 rounded-lg bg-orange-50 text-orange-700 font-bold text-sm"
            >
              All Equipment
            </Link>
            <Link
              href="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center space-x-1.5 p-3 rounded-lg bg-neutral-100 text-neutral-800 font-semibold text-sm"
            >
              <Shield className="w-4 h-4 text-neutral-500" />
              <span>Admin Portal</span>
            </Link>
          </div>

          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold px-2">
              Gear Categories
            </span>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
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

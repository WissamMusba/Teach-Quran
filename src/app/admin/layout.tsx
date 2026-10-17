'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Sliders,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { name: 'Site Settings', href: '/admin/settings', icon: Sliders },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // If on login page, don't show admin navigation frame
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // ignore — redirect below regardless
    }
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#07070A] text-white flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#000000] text-white border-r border-[#1C1C24] shrink-0">
        {/* Brand */}
        <div className="p-6 border-b border-[#1C1C24] flex items-center space-x-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-seven-districts.png"
            alt="Seven Districts Cricket Academy"
            className="w-10 h-10 object-contain rounded-xl border border-[#2E2E38] bg-[#0A0A0E] p-1 shrink-0"
          />
          <div>
            <h2 className="font-display uppercase text-lg font-black tracking-wider text-white leading-none">
              SEVEN DISTRICTS<span className="text-[#FF5500]">.</span>
            </h2>
            <span className="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
              TSDCA Admin • Ajman
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-4 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-[#FF5500] text-black shadow-orange-glow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-[#121218]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1C1C24] space-y-2">
          <Link
            href="/"
            target="_blank"
            className="flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-[#121218] transition-colors"
          >
            <span className="flex items-center space-x-2">
              <ExternalLink className="w-4 h-4 text-[#FF5500]" />
              <span>Live Storefront</span>
            </span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#07070A]">
        {/* Mobile Top Header */}
        <header className="md:hidden bg-[#000000] text-white p-4 flex items-center justify-between border-b border-[#1C1C24]">
          <div className="flex items-center space-x-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-seven-districts.png"
              alt="Seven Districts Cricket Academy"
              className="w-7 h-7 object-contain rounded-lg border border-[#2E2E38] bg-[#0A0A0E] p-0.5 shrink-0"
            />
            <span className="font-display uppercase text-lg font-black tracking-wider text-white">
              TSDCA ADMIN
            </span>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-1.5 rounded-xl text-neutral-300 hover:bg-[#181822]"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="md:hidden bg-[#000000] text-white border-b border-[#1C1C24] p-4 space-y-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                  pathname.startsWith(item.href)
                    ? 'bg-[#FF5500] text-black'
                    : 'text-neutral-400'
                }`}
              >
                {item.name}
              </Link>
            ))}
            <div className="pt-3 border-t border-[#1C1C24] flex justify-between">
              <Link href="/" target="_blank" className="text-xs text-neutral-400 uppercase font-bold">
                Storefront
              </Link>
              <button onClick={handleLogout} className="text-xs text-red-400 uppercase font-bold">
                Sign Out
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

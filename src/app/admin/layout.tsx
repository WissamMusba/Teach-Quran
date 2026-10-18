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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#07070A] pb-16 md:pb-0">
        {/* Mobile / Foldable Top Header */}
        <header className="md:hidden sticky top-0 z-30 bg-[#000000]/95 backdrop-blur-md text-white px-3 sm:px-4 py-3 flex items-center justify-between border-b border-[#1C1C24] safe-pt">
          <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-seven-districts.png"
              alt="Seven Districts Cricket Academy"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-lg border border-[#2E2E38] bg-[#0A0A0E] p-0.5 shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-display uppercase text-sm sm:text-base font-black tracking-wider text-white truncate">
                TSDCA ADMIN
              </span>
              <span className="text-[9px] text-[#FF5500] font-bold tracking-widest uppercase">
                Ajman • UAE
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/"
              target="_blank"
              className="p-2 rounded-xl text-neutral-400 hover:text-white transition-colors text-xs font-bold"
              title="View Storefront"
              aria-label="View Storefront"
            >
              <ExternalLink className="w-4 h-4 text-[#FF5500]" />
            </Link>
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="p-2 rounded-xl text-neutral-300 hover:bg-[#181822] touch-target flex items-center justify-center"
              aria-label={mobileSidebarOpen ? 'Close Menu' : 'Open Menu'}
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Fullscreen Drawer / Menu Overlay */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-md pt-16 flex flex-col animate-fade-in">
            <div className="p-4 bg-[#0A0A0E] border-b border-[#1C1C24] space-y-2 flex-1 overflow-y-auto">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-3 block mb-1">
                Admin Navigation
              </span>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider touch-target transition-all ${
                      isActive
                        ? 'bg-[#FF5500] text-black shadow-orange-glow-sm'
                        : 'text-neutral-300 hover:bg-[#181824]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              <div className="pt-4 mt-4 border-t border-[#1C1C24] space-y-2">
                <Link
                  href="/"
                  target="_blank"
                  className="flex items-center space-x-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-[#121218]"
                >
                  <ExternalLink className="w-4 h-4 text-[#FF5500]" />
                  <span>Live Storefront</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-950/20 text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-3 xs:p-4 sm:p-6 lg:p-10">{children}</main>

        {/* Mobile / Foldable Fixed Quick Bar */}
        <nav
          aria-label="Admin Mobile Navigation"
          className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-[#0A0A0E]/95 backdrop-blur-xl border-t border-[#1C1C24] px-2 py-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.8)]"
          style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
        >
          <div className="grid grid-cols-4 items-center max-w-md mx-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-colors ${
                    isActive
                      ? 'text-[#FF5500]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  <span className="text-[9px] font-bold tracking-tight uppercase mt-0.5 truncate max-w-full">
                    {item.name.replace('Site ', '')}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

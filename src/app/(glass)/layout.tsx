import React from 'react';
import type { Metadata } from 'next';
import { AmbientBackground } from '@/components/glass/AmbientBackground';
import { GlassNavbar } from '@/components/glass/GlassNavbar';
import { GlassFooter } from '@/components/glass/GlassFooter';
import { CartDrawer } from '@/components/storefront/CartDrawer';

import { MobileBottomBar } from '@/components/storefront/MobileBottomBar';

export const metadata: Metadata = {
  title: 'Seven Districts Cricket Academy | Pro Shop — Ajman, UAE',
  description:
    'Shop tournament-grade cricket gear at the Seven Districts Cricket Academy pro shop in Ajman — English willow bats, match balls, batting pads, gloves and helmets with fast UAE-wide delivery.',
};

export const revalidate = 60;

/**
 * Main storefront — Liquid Glass design. Includes ergonomic mobile bottom bar
 * for one-thumb access on standard smartphones and foldable devices.
 */
export default function GlassLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#f4f4f6] text-neutral-900 selection:bg-[#FF5500] selection:text-black transition-colors duration-200 dark:bg-[#050506] dark:text-white pb-14 md:pb-0">
      <AmbientBackground />
      <GlassNavbar />
      <main className="relative z-10 flex-1">{children}</main>
      <GlassFooter />
      <MobileBottomBar />
      <CartDrawer />
    </div>
  );
}

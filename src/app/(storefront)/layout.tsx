import React from 'react';
import { getSiteSettings } from '@/lib/supabaseServer';
import { AnnouncementBar } from '@/components/storefront/AnnouncementBar';
import { Navbar } from '@/components/storefront/Navbar';
import { Footer } from '@/components/storefront/Footer';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { MobileBottomBar } from '@/components/storefront/MobileBottomBar';

export const revalidate = 60;

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();

  return (
    <div className="flex flex-col min-h-screen bg-white text-neutral-900 dark:bg-[#050505] dark:text-white selection:bg-[#FF5500] selection:text-white transition-colors duration-200">
      <AnnouncementBar text={settings.announcement_text} />
      <Navbar />
      <main className="flex-1 pb-20 md:pb-0 min-w-0">{children}</main>
      <CartDrawer />
      <MobileBottomBar />
      <Footer />
    </div>
  );
}

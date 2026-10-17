import React from 'react';
import { getSiteSettings } from '@/lib/supabaseServer';
import { AnnouncementBar } from '@/components/storefront/AnnouncementBar';
import { Navbar } from '@/components/storefront/Navbar';
import { Footer } from '@/components/storefront/Footer';
import { CartDrawer } from '@/components/storefront/CartDrawer';

export const revalidate = 60;

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();

  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-white selection:bg-[#FF5500] selection:text-black">
      <AnnouncementBar text={settings.announcement_text} />
      <Navbar />
      <main className="flex-1">{children}</main>
      <CartDrawer />
      <Footer />
    </div>
  );
}

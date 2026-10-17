import React from 'react';
import { getSiteSettings } from '@/lib/supabaseServer';
import { SiteSettingsForm } from '@/components/admin/SiteSettingsForm';
import { requireAdminPage } from '@/lib/adminGuard';

export const revalidate = 0;

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const settings = await getSiteSettings();

  return (
    <div className="space-y-8 max-w-7xl text-white">
      <div className="pb-6 border-b border-[#1C1C24]">
        <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-white tracking-tight">
          Homepage Banner & Announcement CMS
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Customize the prominent announcement bar message, hero messaging, and main banner media across the storefront.
        </p>
      </div>

      <SiteSettingsForm initialSettings={settings} />
    </div>
  );
}

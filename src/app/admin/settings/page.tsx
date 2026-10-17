import React from 'react';
import { getSiteSettings } from '@/lib/supabaseServer';
import { SiteSettingsForm } from '@/components/admin/SiteSettingsForm';

export const revalidate = 0;

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
          Homepage Banner & Announcement CMS
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Customize the prominent announcement bar message, hero messaging, and main banner media across the storefront.
        </p>
      </div>

      <SiteSettingsForm initialSettings={settings} />
    </div>
  );
}

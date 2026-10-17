'use client';

import React, { useState } from 'react';
import { SiteSettings } from '@/lib/types';
import { ImageDropzone } from './ImageDropzone';
import { Save, Loader2, CheckCircle2, Sliders, Sparkles } from 'lucide-react';

interface SiteSettingsFormProps {
  initialSettings: SiteSettings;
}

export const SiteSettingsForm: React.FC<SiteSettingsFormProps> = ({ initialSettings }) => {
  const [announcementText, setAnnouncementText] = useState(
    initialSettings.announcement_text || ''
  );
  const [heroHeadline, setHeroHeadline] = useState(initialSettings.hero_headline || '');
  const [heroSubheadline, setHeroSubheadline] = useState(
    initialSettings.hero_subheadline || ''
  );
  const [bannerImages, setBannerImages] = useState<string[]>(
    initialSettings.hero_banner_image ? [initialSettings.hero_banner_image] : []
  );

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcement_text: announcementText,
          hero_headline: heroHeadline,
          hero_subheadline: heroSubheadline,
          hero_banner_image: bannerImages[0] || '',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update settings');
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Homepage banner & announcement bar settings successfully saved!</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Top Announcement Bar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-neutral-100">
          <Sliders className="w-5 h-5 text-orange-600" />
          <h2 className="text-base font-bold text-neutral-900">
            Top Charcoal Announcement Bar
          </h2>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
            Announcement Message
          </label>
          <input
            type="text"
            required
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="e.g. Fast delivery across the region on all cricket equipment."
            className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
          <p className="text-[11px] text-neutral-400 mt-1.5">
            Displayed prominently in white text across the full-width charcoal black bar at the very top of all pages.
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex items-center space-x-2 pb-3 border-b border-neutral-100">
          <Sparkles className="w-5 h-5 text-orange-600" />
          <h2 className="text-base font-bold text-neutral-900">
            Storefront Hero Banner Content
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Hero Headline
            </label>
            <input
              type="text"
              required
              value={heroHeadline}
              onChange={(e) => setHeroHeadline(e.target.value)}
              placeholder="e.g. Engineered for the Perfect Stroke."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Hero Subheadline
            </label>
            <textarea
              rows={3}
              required
              value={heroSubheadline}
              onChange={(e) => setHeroSubheadline(e.target.value)}
              placeholder="e.g. Premium bats, protective gear, and equipment for serious cricketers."
              className="w-full text-sm p-3.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Hero Banner Image (Supabase Storage: product-media)
            </label>
            <ImageDropzone
              images={bannerImages}
              onChange={setBannerImages}
              maxFiles={1}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Update Site Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

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
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl text-white">
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-center space-x-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>Homepage banner & announcement bar settings successfully updated!</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Top Announcement Bar */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-7 shadow-xl space-y-5">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-[#1C1C24]">
          <Sliders className="w-5 h-5 text-[#FF5500]" />
          <h2 className="font-display uppercase text-2xl font-black text-white">
            Top Pitch-Black Announcement Bar
          </h2>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
            Announcement Message
          </label>
          <input
            type="text"
            required
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="e.g. Fast delivery across the region on all cricket equipment."
            className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
          />
          <p className="text-[11px] text-neutral-500 mt-2">
            Displayed prominently in white and orange at the very top of all customer-facing pages.
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-7 shadow-xl space-y-5">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-[#1C1C24]">
          <Sparkles className="w-5 h-5 text-[#FF5500]" />
          <h2 className="font-display uppercase text-2xl font-black text-white">
            Storefront Hero Banner Content
          </h2>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Hero Headline (Bold Athletic Display)
            </label>
            <input
              type="text"
              required
              value={heroHeadline}
              onChange={(e) => setHeroHeadline(e.target.value)}
              placeholder="e.g. Engineered for the Perfect Stroke."
              className="w-full text-xs px-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Hero Subheadline
            </label>
            <textarea
              rows={3}
              required
              value={heroSubheadline}
              onChange={(e) => setHeroSubheadline(e.target.value)}
              placeholder="e.g. Premium bats, protective gear, and equipment for serious cricketers."
              className="w-full text-xs p-4 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Hero Banner Image (Supabase: product-media)
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
          className="inline-flex items-center space-x-2 px-8 py-3.5 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black text-xs uppercase tracking-wider transition-all shadow-orange-glow active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-black" />
              <span>Update Site Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

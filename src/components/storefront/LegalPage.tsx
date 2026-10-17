import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale } from 'lucide-react';

interface LegalPageProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for policy pages (privacy, terms, cookies, returns, shipping,
 * contact) so they all share the same dark theme, header and footer call-out.
 */
export const LegalPage: React.FC<LegalPageProps> = ({
  eyebrow = 'Policies & Legal',
  title,
  intro,
  lastUpdated = '17 October 2026',
  children,
}) => {
  return (
    <div className="bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-white min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-neutral-500 hover:text-[#FF5500] dark:text-neutral-400 dark:hover:text-[#FF5500] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Store</span>
          </Link>
        </div>

        <header className="mb-10 pb-6 border-b border-neutral-200 dark:border-[#1C1C24]">
          <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#FF5500] mb-2">
            <Scale className="w-4 h-4" />
            <span>{eyebrow}</span>
          </div>
          <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-neutral-950 dark:text-white tracking-tight">
            {title}
          </h1>
          {intro && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">{intro}</p>}
          <p className="mt-4 text-[11px] uppercase tracking-wider font-bold text-neutral-400 dark:text-neutral-500">
            Last updated: {lastUpdated}
          </p>
        </header>

        <div className="space-y-10">{children}</div>

        <div className="mt-14 bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-6 text-xs text-neutral-600 dark:text-neutral-400 space-y-2 shadow-sm">
          <p className="font-black uppercase tracking-wider text-neutral-950 dark:text-white">
            Questions about this policy?
          </p>
          <p>
            Visit our{' '}
            <Link href="/contact" className="text-[#FF5500] hover:underline font-bold">
              Contact page
            </Link>{' '}
            or email <a href="mailto:info@sevendistricts.ae" className="text-[#FF5500] hover:underline">info@sevendistricts.ae</a>. We respond to every request as quickly as we can.
          </p>
        </div>
      </div>
    </div>
  );
};

export const LegalSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  return (
    <section className="space-y-3">
      <h2 className="font-display uppercase text-xl font-black text-neutral-950 dark:text-white tracking-tight border-b border-neutral-200 dark:border-[#1C1C24] pb-2">
        {title}
      </h2>
      <div className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{children}</div>
    </section>
  );
};

export const LegalList: React.FC<{ items: React.ReactNode[] }> = ({ items }) => {
  return (
    <ul className="list-disc pl-5 space-y-1.5 marker:text-[#FF5500]">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
};

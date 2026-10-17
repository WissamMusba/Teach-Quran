import React from 'react';
import Link from 'next/link';
import { Compass, Home, SearchX } from 'lucide-react';

export const NotFoundContent: React.FC = () => {
  return (
    <div className="bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-white min-h-[70vh] flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-10 text-center space-y-6 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-[#FF5500]/10 border border-[#FF5500]/30 flex items-center justify-center mx-auto text-[#FF5500]">
          <SearchX className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-[#FF5500]">
            Error 404
          </span>
          <h1 className="font-display uppercase text-3xl font-black text-neutral-950 dark:text-white tracking-tight">
            Off the Pitch
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
            The page you are looking for was moved, removed, or never made the team sheet.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
          <Link
            href="/"
            className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-[#FF5500] hover:bg-[#E04B00] text-white font-black uppercase tracking-wider text-xs transition-colors shadow-orange-glow-sm"
          >
            <Home className="w-4 h-4 text-white" />
            <span>Back to Home</span>
          </Link>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-neutral-900 hover:bg-black text-white dark:bg-[#16161E] dark:hover:bg-[#1E1E28] border border-neutral-800 dark:border-[#2A2A38] font-black uppercase tracking-wider text-xs transition-colors"
          >
            <Compass className="w-4 h-4 text-[#FF5500]" />
            <span>Browse the Catalog</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

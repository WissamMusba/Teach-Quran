'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Storefront error boundary:', error);
  }, [error]);

  return (
    <div className="bg-[#050505] text-white min-h-[70vh] flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full bg-[#0E0E14] border border-[#22222A] rounded-3xl p-10 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-950/60 border border-amber-700/60 flex items-center justify-center mx-auto text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-[#FF5500]">
            Something Broke
          </span>
          <h1 className="font-display uppercase text-3xl font-black text-white tracking-tight">
            A Wicket Fell Unexpectedly
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400">
            An unexpected error interrupted this page. Please try again — if the problem persists,
            contact our support team.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-wider text-xs transition-colors shadow-orange-glow-sm"
          >
            <RotateCcw className="w-4 h-4 text-black" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-[#16161E] hover:bg-[#1E1E28] border border-[#2A2A38] text-white font-black uppercase tracking-wider text-xs transition-colors"
          >
            <Home className="w-4 h-4 text-[#FF5500]" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

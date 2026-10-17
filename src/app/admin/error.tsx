'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error boundary:', error);
  }, [error]);

  return (
    <div className="bg-[#050505] text-white min-h-screen flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full bg-[#0E0E14] border border-[#22222A] rounded-3xl p-10 text-center space-y-6 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-700/60 flex items-center justify-center mx-auto text-amber-400">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display uppercase text-2xl font-black text-white tracking-tight">
            Admin Panel Error
          </h1>
          <p className="text-xs text-neutral-400">
            Something went wrong loading this admin screen. Retry, or head back to the dashboard.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-wider text-xs transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-black" />
            <span>Try Again</span>
          </button>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#16161E] hover:bg-[#1E1E28] border border-[#2A2A38] text-white font-black uppercase tracking-wider text-xs transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

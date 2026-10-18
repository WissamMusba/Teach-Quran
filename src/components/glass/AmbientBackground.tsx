import React from 'react';

/**
 * Fixed ambient field of drifting orbs behind the Liquid Glass preview.
 * Pure CSS animation — automatically stilled by the global
 * prefers-reduced-motion rule in globals.css.
 */
export const AmbientBackground: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="orb-a absolute -right-40 -top-48 h-[40rem] w-[40rem] rounded-full bg-[#FF5500]/15 blur-[140px] dark:bg-[#FF5500]/20" />
    <div className="orb-b absolute -left-56 top-1/4 h-[36rem] w-[36rem] rounded-full bg-[#EA580C]/[0.12] blur-[140px] dark:bg-[#EA580C]/[0.16]" />
    <div className="orb-a absolute -bottom-40 right-1/3 h-[32rem] w-[32rem] rounded-full bg-white/60 blur-[130px] dark:bg-white/[0.05]" />
  </div>
);

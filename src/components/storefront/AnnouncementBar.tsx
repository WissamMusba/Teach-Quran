import React from 'react';
import { Truck, Zap } from 'lucide-react';

interface AnnouncementBarProps {
  text?: string;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  text = 'Fast delivery across the region on all cricket equipment.',
}) => {
  return (
    <div className="bg-[#000000] text-white text-xs py-2 px-4 border-b border-[#222228] relative overflow-hidden">
      {/* Subtle top orange glow accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-[1px] bg-gradient-to-r from-transparent via-[#FF5500] to-transparent" />
      <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2.5 font-bold uppercase tracking-widest text-[11px]">
        <Zap className="w-3.5 h-3.5 text-[#FF5500] shrink-0 animate-pulse" />
        <span className="truncate text-neutral-200">{text}</span>
        <Truck className="w-3.5 h-3.5 text-[#FF5500] shrink-0 hidden sm:inline" />
      </div>
    </div>
  );
};

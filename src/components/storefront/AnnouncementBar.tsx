import React from 'react';
import { Truck } from 'lucide-react';

interface AnnouncementBarProps {
  text?: string;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  text = 'Fast delivery across the region on all cricket equipment.',
}) => {
  return (
    <div className="bg-[#0F172A] text-white text-xs sm:text-sm py-2 px-4 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2 font-medium tracking-wide">
        <Truck className="w-4 h-4 text-orange-500 shrink-0" />
        <span className="truncate">{text}</span>
      </div>
    </div>
  );
};

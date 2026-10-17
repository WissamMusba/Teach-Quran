import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const CATEGORIES = [
  {
    name: 'English Willow Bats',
    slug: 'bats',
    count: 'Grade 1 & 2 Match Profiles',
    image: 'https://images.unsplash.com/photo-1593341646782-e0b495cff86d?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1 md:col-span-2 lg:col-span-2',
  },
  {
    name: 'Match Leather Balls',
    slug: 'balls',
    count: '4-Piece Test Regulation',
    image: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Batting Legguards',
    slug: 'pads',
    count: 'Pro HD Foam Protection',
    image: 'https://images.unsplash.com/photo-1531415074868-036b107e775a?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Batting Gloves',
    slug: 'gloves',
    count: 'Pittards Leather Palms',
    image: 'https://images.unsplash.com/photo-1531415074868-036b107e775a?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Titanium Helmets',
    slug: 'helmets',
    count: 'BS 7928:2013 Dual Grille',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Kit Bags & Wheelies',
    slug: 'bags',
    count: 'Heavy Duty 140L+ Lockers',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1 md:col-span-2 lg:col-span-1',
  },
];

export const CategoryGrid: React.FC = () => {
  return (
    <section className="py-20 bg-white dark:bg-[#050505] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 border-b border-neutral-200 dark:border-[#1C1C24] pb-6">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#FF5500] block mb-1">
              Tournament Departments
            </span>
            <h2 className="font-display uppercase text-3xl sm:text-5xl font-black text-black dark:text-white tracking-tight">
              Shop by Category
            </h2>
          </div>
          <Link
            href="/shop"
            className="mt-4 sm:mt-0 inline-flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider text-neutral-700 hover:text-[#FF5500] dark:text-neutral-300 dark:hover:text-[#FF5500] transition-colors"
          >
            <span>View All Equipment</span>
            <ArrowUpRight className="w-4 h-4 text-[#FF5500]" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/shop?category=${cat.slug}`}
              className={`group relative overflow-hidden rounded-2xl border border-[#22222A] bg-[#0E0E13] h-64 sm:h-72 transition-all duration-300 hover:border-[#FF5500]/80 hover:shadow-orange-glow ${cat.span}`}
            >
              {/* Background Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover opacity-50 group-hover:scale-108 group-hover:opacity-70 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />

              {/* Text overlay */}
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#FF5500] mb-1">
                  {cat.count}
                </span>
                <h3 className="font-display uppercase text-2xl sm:text-3xl font-black text-white group-hover:text-white transition-colors leading-tight">
                  {cat.name}
                </h3>

                {/* Subtle bottom orange accent bar */}
                <div className="w-0 group-hover:w-16 h-[3px] bg-[#FF5500] transition-all duration-300 mt-2 shadow-orange-glow-sm" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

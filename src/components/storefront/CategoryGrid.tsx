import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const CATEGORIES = [
  {
    name: 'English Willow Bats',
    slug: 'bats',
    count: 'Grade 1 & 2',
    image: 'https://images.unsplash.com/photo-1593341646782-e0b495cff86d?q=80&w=600&auto=format&fit=crop',
    span: 'col-span-1 md:col-span-2 lg:col-span-2',
  },
  {
    name: 'Match Leather Balls',
    slug: 'balls',
    count: '4-Piece Regulation',
    image: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=600&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Batting Legguards',
    slug: 'pads',
    count: 'Pro HD Foam',
    image: 'https://images.unsplash.com/photo-1531415074868-036b107e775a?q=80&w=600&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Batting Gloves',
    slug: 'gloves',
    count: 'Pittards Leather',
    image: 'https://images.unsplash.com/photo-1531415074868-036b107e775a?q=80&w=600&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Titanium Helmets',
    slug: 'helmets',
    count: 'BS 7928:2013',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=600&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Kit Bags & Wheelies',
    slug: 'bags',
    count: 'Heavy Duty 140L+',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=600&auto=format&fit=crop',
    span: 'col-span-1 md:col-span-2 lg:col-span-1',
  },
];

export const CategoryGrid: React.FC = () => {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600 block mb-1">
              Curated Equipment
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
              Shop by Category
            </h2>
          </div>
          <Link
            href="/shop"
            className="mt-3 sm:mt-0 inline-flex items-center space-x-1 text-sm font-semibold text-neutral-900 hover:text-orange-600 transition-colors"
          >
            <span>View All Equipment</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/shop?category=${cat.slug}`}
              className={`group relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900 h-60 transition-transform duration-300 hover:-translate-y-1 hover:shadow-md ${cat.span}`}
            >
              {/* Background */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover opacity-60 group-hover:scale-105 group-hover:opacity-75 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/40 to-transparent" />

              {/* Text overlay */}
              <div className="absolute inset-0 p-5 flex flex-col justify-end">
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                  {cat.count}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-orange-300 transition-colors">
                  {cat.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

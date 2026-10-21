import type { SiteSettings } from '@/lib/types';

export interface HeroSlide {
  id: string;
  image: string;
  tagline: string;
  title: string;
  subtitle: string;
  priceBadge?: string;
  primaryCta: { label: string; href: string };
  secondaryCtas: Array<{ label: string; href: string }>;
}

/**
 * Shared hero slideshow content — used by both the athletic storefront hero
 * and the Liquid Glass preview hero so the two designs stay in sync.
 */
export function buildHeroSlides(settings: SiteSettings): HeroSlide[] {
  return [
    {
      id: 'bats',
      image:
        settings.hero_banner_image ||
        'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1920&auto=format&fit=crop',
      tagline: 'CRICKET OBSESSED • CG SPORTS',
      title: 'Shop Grade 1 English Willow Bats',
      subtitle:
        'Hand-selected clefts from Kookaburra, Gray-Nicolls, SG & SS with massive edges, high spines, and featherlight pick-up.',
      priceBadge: 'Starting from AED 1,299',
      primaryCta: { label: 'Shop Bats', href: '/shop?category=bats' },
      secondaryCtas: [
        { label: 'Kookaburra', href: '/shop?brand=Kookaburra' },
        { label: 'Gray-Nicolls', href: '/shop?brand=Gray-Nicolls' },
        { label: 'SS Bats', href: '/shop?brand=SS' },
      ],
    },
    {
      id: 'balls',
      image: 'https://images.unsplash.com/photo-1531415074868-036b107e775a?q=80&w=1920&auto=format&fit=crop',
      tagline: 'TOURNAMENT MATCH BALLS • TEST QUALITY',
      title: 'Four-Piece County & Match Leather Balls',
      subtitle:
        'Handcrafted alum-tanned steer hide with pronounced hand-stitched seams and Portuguese cork centers for lasting swing.',
      priceBadge: 'Match Packs from AED 95',
      primaryCta: { label: 'Shop Match Balls', href: '/shop?category=balls' },
      secondaryCtas: [
        { label: 'SG White Balls', href: '/shop?brand=SG' },
        { label: 'Boxes of 6', href: '/shop?category=balls' },
      ],
    },
    {
      id: 'protection',
      image: 'https://images.unsplash.com/photo-1593341646782-e0b495cff86d?q=80&w=1920&auto=format&fit=crop',
      tagline: 'HIGH IMPACT DEFENSE • PRO COMFORT',
      title: 'Test Batting Legguards & Pittards Gloves',
      subtitle:
        'High-density EVA impact foam, traditional cane splits, and premium sheepskin palms engineered for 145+ km/h pace bowling.',
      priceBadge: 'Pads & Gloves from AED 180',
      primaryCta: { label: 'Shop Batting Pads', href: '/shop?category=pads' },
      secondaryCtas: [
        { label: 'Batting Gloves', href: '/shop?category=gloves' },
        { label: 'Helmets', href: '/shop?category=helmets' },
      ],
    },
    {
      id: 'academy',
      image: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=1920&auto=format&fit=crop',
      tagline: 'CG SPORTS • LOCATED AT SEVEN DISTRICTS, AJMAN',
      title: 'Official CG Sports Pro Shop & Match Gear',
      subtitle:
        'Equipping cricketers across Ajman and all 7 UAE Emirates with tournament-grade gear, card security, and Cash on Delivery.',
      priceBadge: 'Fast Courier Across UAE',
      primaryCta: { label: 'Shop All Gear', href: '/shop' },
      secondaryCtas: [
        { label: 'Authorized Brands', href: '/shop' },
        { label: 'Kit Bags', href: '/shop?category=bags' },
      ],
    },
  ];
}

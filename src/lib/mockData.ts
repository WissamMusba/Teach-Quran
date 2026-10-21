import { Product, SiteSettings, Order } from './types';

export const INITIAL_SITE_SETTINGS: SiteSettings = {
  id: 1,
  announcement_text: 'CG Sports • Fast Delivery Across Ajman & All UAE Emirates • Bank Transfer & Cash on Delivery Accepted',
  hero_headline: 'CG Sports — Pro Cricket Equipment & Match Gear',
  hero_subheadline: 'Grade 1 English Willow bats, match balls, and protective gear from top brands at CG Sports. Fast delivery across Ajman and all UAE Emirates.',
  hero_banner_image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop',
  updated_at: new Date().toISOString(),
};

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_ORDERS: Order[] = [];

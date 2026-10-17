import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/supabaseServer';
import { getSiteUrl } from '@/lib/site';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/shop`, lastModified, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/contact`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/shipping`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/returns`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/cookies`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];

  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = await getProducts({ isActive: true, limit: 1000 });
    productRoutes = products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      lastModified: product.created_at ? new Date(product.created_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch {
    // A sitemap failure must never break the build — ship the static routes.
  }

  return [...staticRoutes, ...productRoutes];
}

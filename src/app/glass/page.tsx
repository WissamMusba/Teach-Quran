import { redirect } from 'next/navigation';

/**
 * The Liquid Glass design moved to the site root (/). Keep this route as a
 * permanent bridge for any previously shared /glass links.
 */
export default function GlassRedirectPage() {
  redirect('/');
}

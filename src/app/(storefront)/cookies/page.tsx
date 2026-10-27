import React from 'react';
import type { Metadata } from 'next';
import { LegalPage, LegalSection, LegalList } from '@/components/storefront/LegalPage';

export const metadata: Metadata = {
  title: 'Cookie Notice',
  description:
    'The complete inventory of cookies and local storage used by our store — strictly necessary storage only.',
  alternates: { canonical: '/cookies' },
};

export default function CookieNoticePage() {
  return (
    <LegalPage
      title="Cookie Notice"
      intro="This notice lists every cookie and piece of browser storage this store uses — and why we do not show a consent banner today."
    >
      <LegalSection title="1. What Are Cookies and Local Storage?">
        <p>
          Cookies are small files a website stores in your browser and sends back with requests.
          Local storage is similar but stays entirely on your device. Both are commonly used to
          keep a site working — for example, remembering your cart or keeping a staff session
          signed in.
        </p>
      </LegalSection>

      <LegalSection title="2. Storage Used by This Store">
        <p>We use only strictly necessary storage:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-[#22222A] rounded-xl overflow-hidden">
            <thead className="bg-[#121218] text-neutral-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4">Lifetime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C24] text-neutral-300">
              <tr>
                <td className="py-3 px-4 font-mono text-white">cricket_store_cart</td>
                <td className="py-3 px-4">Local storage (shoppers)</td>
                <td className="py-3 px-4">
                  Remembers your shopping cart contents on your own device so the cart survives a
                  page refresh. Never sent to us until you check out.
                </td>
                <td className="py-3 px-4">Until you clear it or finish checkout</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-white">sdca_admin_session</td>
                <td className="py-3 px-4">Cookie (staff only)</td>
                <td className="py-3 px-4">
                  Keeps store staff signed in to the administration area. HttpOnly, Secure and
                  SameSite — never set for regular shoppers.
                </td>
                <td className="py-3 px-4">Short-lived session</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-white">sdca_admin_refresh</td>
                <td className="py-3 px-4">Cookie (staff only)</td>
                <td className="py-3 px-4">
                  Refreshes a staff member&apos;s session so they are not signed out mid-task.
                  HttpOnly, Secure and SameSite.
                </td>
                <td className="py-3 px-4">Up to 30 days, revoked on sign-out</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="3. What We Do Not Use">
        <LegalList
          items={[
            'No analytics or statistics cookies (for example Google Analytics).',
            'No advertising or marketing cookies.',
            'No cross-site tracking or profiling of any kind.',
            'No social media pixels.',
          ]}
        />
        <p>
          Because the store currently uses only strictly necessary storage, no consent banner is
          required or shown. If we ever add analytics or marketing tools, we will update this
          notice and ask for your consent <em>before</em> those tools run.
        </p>
      </LegalSection>

      <LegalSection title="4. Third-Party Payments">
        <p>
          When you choose card payment, you are redirected to Stripe&apos;s secure checkout page.
          Stripe may set its own cookies while you are on their pages to process the payment
          securely and prevent fraud — those cookies are governed by{' '}
          <span className="text-white font-semibold">Stripe&apos;s own privacy policy</span>, not
          this notice. We do not embed third-party trackers on our pages.
        </p>
      </LegalSection>

      <LegalSection title="5. Managing or Removing Storage">
        <LegalList
          items={[
            'You can delete cookies and local storage at any time through your browser settings (usually under "Privacy" or "Site data").',
            'Clearing local storage will empty your cart — nothing else on the store depends on your device storage.',
            'Blocking all cookies may prevent staff features from working, but the storefront will continue to function.',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Contact">
        <p>
          Questions about this notice? Contact us at{' '}
          <a href="mailto:reears966@gmail.com" className="text-[#FF5500] hover:underline">
            reears966@gmail.com
          </a>
          , or see our{' '}
          <a href="/privacy" className="text-[#FF5500] hover:underline font-bold">
            Privacy Policy
          </a>{' '}
          for how we handle personal information more broadly.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

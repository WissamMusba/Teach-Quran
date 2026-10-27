import React from 'react';
import type { Metadata } from 'next';
import { LegalPage, LegalSection, LegalList } from '@/components/storefront/LegalPage';

export const metadata: Metadata = {
  title: 'Shipping & Delivery',
  description:
    'Free tracked courier delivery across the UAE, dispatch times, international shipping and what to do if a parcel is delayed or damaged.',
  alternates: { canonical: '/shipping' },
};

export default function ShippingPage() {
  return (
    <LegalPage
      title="Shipping & Delivery"
      intro="Tracked courier delivery, free across the UAE. Here is what to expect from the moment you order."
    >
      <LegalSection title="1. Order Processing">
        <p>
          Orders are typically processed within <strong className="text-white">1–2 business days</strong>{' '}
          (Sunday–Thursday in the UAE, excluding public holidays). During busy periods or for bulk
          orders we will contact you if dispatch will take longer.
        </p>
      </LegalSection>

      <LegalSection title="2. UAE Delivery">
        <LegalList
          items={[
            <><strong className="text-white">Cost:</strong> free tracked courier delivery on all UAE orders.</>,
            <><strong className="text-white">Time:</strong> typically 2–5 business days after dispatch, depending on the emirate.</>,
            <><strong className="text-white">Cash on Delivery:</strong> available UAE-wide — pay the courier the exact amount shown on your order confirmation.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="3. International Delivery">
        <LegalList
          items={[
            'We ship to selected international destinations shown at checkout. Card payment is required for international orders (COD is not available).',
            'Delivery times vary by destination; we will share an estimate when your order is dispatched.',
            'Any customs duties, import taxes or clearance fees charged by your country are the recipient\'s responsibility and are not included in your order total.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Tracking Your Order">
        <p>
          When your order is dispatched we send tracking details to the email address and phone
          number on your order. Tracking can take a few hours to activate on the courier&apos;s
          system after dispatch.
        </p>
      </LegalSection>

      <LegalSection title="5. Failed or Missed Deliveries">
        <LegalList
          items={[
            'Please provide an accurate address and a reachable phone number — our couriers call before delivery.',
            'If delivery fails because nobody is available or the address is incorrect, the courier will attempt to arrange redelivery or a collection point.',
            'Repeated failed deliveries may result in the parcel being returned to us; in that case we will contact you to arrange reshipment (which may involve an additional shipping fee) or a refund.',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Damaged or Missing Parcels">
        <p>
          If a parcel arrives visibly damaged, please note it with the courier where possible and
          contact us within <strong className="text-white">48 hours</strong> with photographs.
          Items damaged in transit or lost by the courier are resolved by us — you will receive a
          replacement or refund. See our{' '}
          <a href="/returns" className="text-[#FF5500] hover:underline font-bold">
            Returns &amp; Refunds
          </a>{' '}
          page for how we handle claims.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          Delivery questions? Reach us at{' '}
          <a href="mailto:reears966@gmail.com" className="text-[#FF5500] hover:underline">
            reears966@gmail.com
          </a>{' '}
          or via the{' '}
          <a href="/contact" className="text-[#FF5500] hover:underline font-bold">
            Contact page
          </a>{' '}
          — include your order reference for the fastest answer.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

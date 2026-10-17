import React from 'react';
import type { Metadata } from 'next';
import { LegalPage, LegalSection, LegalList } from '@/components/storefront/LegalPage';

export const metadata: Metadata = {
  title: 'Returns & Refunds',
  description:
    'How to return cricket equipment, what is eligible, and how quickly refunds are processed — including faulty goods and wrong items.',
  alternates: { canonical: '/returns' },
};

export default function ReturnsPage() {
  return (
    <LegalPage
      title="Returns & Refunds"
      intro="Straightforward returns within 14 days, and full protection for faulty or incorrect items. Here is exactly how it works."
    >
      <LegalSection title="1. The 14-Day Return Window">
        <p>
          You can request a return within <strong className="text-white">14 days of delivery</strong>{' '}
          for most items, provided they are:
        </p>
        <LegalList
          items={[
            'Unused and in the condition you received them — not played with, knocked in, oiled or fitted.',
            'In their original packaging with tags, protective film and seals intact.',
            'Returned with proof of purchase (your order reference is enough).',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Items That Cannot Be Returned">
        <LegalList
          items={[
            'Bats that have been knocked in, oiled, or have had grip or sticker alterations.',
            'Any equipment used in play or practice, or showing signs of wear.',
            'Personalised or custom-made items.',
            'Items marked as final sale or clearance at the time of purchase.',
          ]}
        />
        <p>This does not limit your rights if an item is faulty — see section 3.</p>
      </LegalSection>

      <LegalSection title="3. Faulty, Damaged or Incorrect Items">
        <p>
          If your item arrives damaged, is faulty, or is not what you ordered, contact us within{' '}
          <strong className="text-white">48 hours of delivery</strong> with photographs of the
          item and packaging. We will arrange a replacement or refund — including return shipping
          costs — as quickly as possible. These remedies are in addition to your statutory
          consumer rights, which these policies do not affect.
        </p>
      </LegalSection>

      <LegalSection title="4. How to Start a Return">
        <LegalList
          items={[
            <>Contact us via the <a href="/contact" className="text-[#FF5500] hover:underline font-bold">Contact page</a> with your order reference and reason for return.</>,
            'We will reply with return instructions within 2 business days.',
            'Pack the item securely and send it back using a tracked service, following the instructions we provide.',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Return Shipping Costs">
        <p>
          For change-of-mind returns, return shipping is paid by you, and we recommend a tracked
          service — we cannot refund items that go missing in transit back to us. If the item is
          faulty, damaged or incorrect, we cover the return shipping.
        </p>
      </LegalSection>

      <LegalSection title="6. Refunds">
        <LegalList
          items={[
            'Once your return arrives, we inspect it within 5 business days.',
            'Approved refunds are issued to your original payment method within 14 days of approval.',
            'For Cash on Delivery orders, refunds are sent by bank transfer to account details you provide.',
            'Original shipping charges are refunded only where the item was faulty, damaged or incorrect.',
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Exchanges">
        <p>
          Need a different size or model? The fastest route is a return and a fresh order — this
          guarantees the replacement is reserved before stock sells out. Exchanges are subject to
          availability.
        </p>
      </LegalSection>

      <LegalSection title="8. Questions">
        <p>
          If anything is unclear, contact us at{' '}
          <a href="mailto:info@sevendistricts.ae" className="text-[#FF5500] hover:underline">
            info@sevendistricts.ae
          </a>{' '}
          or through the{' '}
          <a href="/contact" className="text-[#FF5500] hover:underline font-bold">
            Contact page
          </a>
          . 
        </p>
      </LegalSection>
    </LegalPage>
  );
}

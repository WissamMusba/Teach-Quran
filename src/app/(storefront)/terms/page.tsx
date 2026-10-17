import React from 'react';
import type { Metadata } from 'next';
import { LegalPage, LegalSection, LegalList } from '@/components/storefront/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern purchases from our online cricket equipment store, including pricing, delivery, returns and liability.',
  alternates: { canonical: '/terms' },
};

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms govern your use of this website and any purchase you make from us. Please read them before placing an order."
    >
      <LegalSection title="1. Agreement to These Terms">
        <p>
          This website is operated by Seven Districts Cricket Academy (TSDCA), located in Ajman,
          United Arab Emirates (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By browsing the store or
          placing an order, you agree to these Terms of Service. If you do not agree, please do not
          use the site.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be at least 18 years old, or have a parent or guardian&apos;s permission, to
          place an order. By ordering, you confirm the information you give us is accurate and
          complete.
        </p>
      </LegalSection>

      <LegalSection title="3. Products, Descriptions and Availability">
        <LegalList
          items={[
            'We make every effort to display products, specifications and images accurately. Images are illustrative; natural materials such as English Willow can vary slightly in grain and colour.',
            'All orders are subject to stock availability. If an item becomes unavailable after you order, we will contact you and refund any amount paid for it.',
            'We may correct pricing or description errors and cancel affected orders, with a full refund of any amount paid, before your order is dispatched.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Prices and Payment">
        <LegalList
          items={[
            'Prices are shown in UAE Dirhams (AED) and are inclusive of any applicable VAT unless stated otherwise.',
            'Card payments are processed securely by Stripe. We never receive or store your full card details.',
            'Cash on Delivery (COD) is available for eligible destinations as shown at checkout. The exact amount is payable to the courier on delivery.',
            'An order is not confirmed until payment is authorised (card) or the order is accepted by us (COD). If a payment fails, the order will not proceed.',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Orders and Acceptance">
        <p>
          When you place an order you will receive an order reference and confirmation. This
          acknowledgement does not mean the order has been accepted — our acceptance takes place
          when we dispatch the goods. We may refuse or cancel an order where the product is
          unavailable, the payment cannot be verified, or we suspect fraud or a pricing error. If
          we cancel, we refund any amount you have paid in full.
        </p>
      </LegalSection>

      <LegalSection title="6. Delivery">
        <LegalList
          items={[
            'Delivery timelines and charges are set out in our Shipping & Delivery policy.',
            'Risk in the goods passes to you on delivery to the address you provide.',
            'Please ensure your delivery address and phone number are accurate and that someone can receive the parcel.',
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Returns and Refunds">
        <p>
          Returns, refunds and faulty-goods handling are governed by our Returns & Refunds policy
          and by any non-excludable rights you have under consumer law.
        </p>
      </LegalSection>

      <LegalSection title="8. Warranty">
        <p>
          Cricket equipment may be covered by a manufacturer&apos;s warranty. If an item develops a
          manufacturing fault, contact us with your order reference, photographs and a description.
          This warranty is in addition to, and does not replace, your statutory consumer rights.
        </p>
      </LegalSection>

      <LegalSection title="9. Our Liability">
        <p>
          Nothing in these terms limits or excludes any liability that cannot lawfully be limited
          or excluded, including liability for death or personal injury caused by negligence and
          your statutory consumer rights.
        </p>
        <p>
          Subject to that, we are not liable for indirect or consequential losses (such as lost
          profits or lost enjoyment), and our total liability for any order is limited to the
          amount you paid for that order.
        </p>
      </LegalSection>

      <LegalSection title="10. Acceptable Use">
        <LegalList
          items={[
            'Do not misuse this site — including attempting to access restricted areas, probing our systems, scraping the catalogue or interfering with other users.',
            'We may suspend or block access for suspected misuse, fraud or unlawful activity.',
          ]}
        />
      </LegalSection>

      <LegalSection title="11. Intellectual Property">
        <p>
          The content of this site (text, layout, graphics and original images) belongs to us or is
          used with permission. Brand names, logos and product images remain the property of their
          respective owners. You may not reproduce our content for commercial purposes without our
          written permission.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing Law and Disputes">
        <p>
          These terms are governed by the laws of the Emirate of Ajman and the federal laws of the
          United Arab Emirates, and the courts of the United Arab Emirates have jurisdiction over any
          dispute, without affecting any mandatory protections you have under the consumer law of your
          country of residence.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to These Terms">
        <p>
          We may update these terms from time to time. The version that applies to your purchase is
          the version published on this page at the time you placed your order.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

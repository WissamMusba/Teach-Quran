import React from 'react';
import type { Metadata } from 'next';
import { LegalPage, LegalSection, LegalList } from '@/components/storefront/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How we collect, use and protect your personal information when you order cricket equipment from our store.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal information we collect, why we collect it, and the choices you have."
    >
      <LegalSection title="1. Who We Are">
        <p>
          CG Sports (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates this online cricket
          equipment store, located at Seven Districts Cricket Academy. We are the data controller responsible
          for your personal information.
        </p>
        <LegalList
          items={[
            <>Location: CG Sports • Located at Seven Districts Cricket Academy, Ajman, United Arab Emirates</>,
            <>Pro Store: Inside Seven Districts Cricket Academy Campus, Ajman, UAE</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <p>We only collect what we need to fulfil your order and support you afterwards:</p>
        <LegalList
          items={[
            <>
              <strong className="text-white">Order &amp; delivery details:</strong> your name,
              email address, phone number and shipping address, provided when you check out.
            </>,
            <>
              <strong className="text-white">Order history:</strong> the items you purchased,
              amounts paid, selected product options and delivery status.
            </>,
            <>
              <strong className="text-white">Payment information:</strong> card payments are
              processed by Stripe. We receive confirmation of payment and limited details (such as
              the payment status and session reference) — we never see or store your full card
              number.
            </>,
            <>
              <strong className="text-white">Support messages:</strong> information you include
              when you contact us about an order.
            </>,
            <>
              <strong className="text-white">Technical data:</strong> our hosting and security
              providers may process basic request data (such as IP address) to serve the site
              securely and prevent abuse. We do not currently run analytics or advertising
              profiling.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="3. How We Use Your Information">
        <LegalList
          items={[
            'To process, pack and deliver your orders, including sharing delivery details with our couriers.',
            'To send you order confirmations, dispatch notices and delivery updates.',
            'To handle returns, refunds, warranty claims and customer support.',
            'To prevent fraud, secure our systems and detect misuse.',
            'To comply with legal, tax and accounting obligations.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Legal Bases for Processing">
        <p>
          Where required by applicable data protection law (including the UAE Personal Data
          Protection Law and, where it applies, the GDPR), we process your information on the
          following bases:
        </p>
        <LegalList
          items={[
            'Performance of a contract — to take payment and deliver your order.',
            'Legitimate interests — to secure our store, prevent fraud and improve our service.',
            'Legal obligation — to keep records required by tax and consumer law.',
            'Consent — where we ask for it (for example, if we ever introduce marketing messages, which you may opt out of at any time).',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Sharing Your Information">
        <p>We share personal information only with parties who help us run the store:</p>
        <LegalList
          items={[
            'Payment processing (Stripe) — to take card payments securely.',
            'Delivery couriers — to deliver your parcel and provide tracking updates.',
            'Hosting and database providers — to operate the store and store your order records.',
            'Professional advisers and authorities — where we are legally required or need to establish, exercise or defend legal claims.',
          ]}
        />
        <p>We do not sell your personal information, and we do not share it for third-party advertising.</p>
      </LegalSection>

      <LegalSection title="6. International Transfers">
        <p>
          Some of our service providers may process data outside your country (including in
          the European Union, United States, and the UAE where Stripe or our couriers operate). Where we transfer personal
          data internationally, we take steps to ensure it receives an adequate level of protection
          through contractual safeguards or equivalent measures.
        </p>
      </LegalSection>

      <LegalSection title="7. How Long We Keep Your Information">
        <p>
          We keep order and transaction records for up to 5 years (in compliance with UAE statutory
          accounting and commercial recordkeeping laws) so we can honour warranties,
          handle disputes and meet tax and accounting requirements. Support messages are kept only
          as long as needed to resolve your enquiry.
        </p>
      </LegalSection>

      <LegalSection title="8. Your Rights">
        <p>Subject to applicable law, you may have the right to:</p>
        <LegalList
          items={[
            'Access the personal information we hold about you.',
            'Request correction of inaccurate or incomplete information.',
            'Request deletion of your information (where we are not required to keep it).',
            'Restrict or object to certain processing.',
            'Request a portable copy of information you provided.',
            'Withdraw any consent you have given at any time.',
          ]}
        />
        <p>
          To exercise any of these rights, contact{' '}
          <a href="mailto:Rizwany3k@gmail.com" className="text-[#FF5500] hover:underline">
            Rizwany3k@gmail.com
          </a>
          . We may ask you to verify your identity before acting on a request. You also have the right to complain to the data
          protection authority in your jurisdiction — in the UAE this is the UAE Data Office.
        </p>
      </LegalSection>

      <LegalSection title="9. How We Protect Your Information">
        <LegalList
          items={[
            'The store is served over encrypted HTTPS connections.',
            'Staff administration is protected by server-verified, HttpOnly session cookies and restricted access.',
            'Payment card data never touches our servers — it is handled entirely by Stripe.',
            'Database access is restricted to the store backend on a need-to-know basis.',
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Cookies & Similar Technologies">
        <p>
          We only use storage that is strictly necessary to run the store. See our{' '}
          <a href="/cookies" className="text-[#FF5500] hover:underline font-bold">
            Cookie Notice
          </a>{' '}
          for the full inventory.
        </p>
      </LegalSection>

      <LegalSection title="11. Children">
        <p>
          Our store is not directed at children under 16. We do not knowingly collect personal
          information from children. If you believe a child has provided us information, contact{' '}
          <a href="mailto:Rizwany3k@gmail.com" className="text-[#FF5500] hover:underline">
            Rizwany3k@gmail.com
          </a>{' '}
          and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to This Policy">
        <p>
          We may update this policy from time to time. The &quot;Last updated&quot; date at the top
          of this page shows when it last changed. Material changes will be communicated clearly
          where required.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

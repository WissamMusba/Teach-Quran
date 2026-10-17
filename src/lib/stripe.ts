import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

export const isStripeConfigured = Boolean(
  stripeSecretKey &&
  !stripeSecretKey.includes('placeholder') &&
  stripeSecretKey.startsWith('sk_')
);

export const stripe = isStripeConfigured
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16' as any,
    })
  : null;

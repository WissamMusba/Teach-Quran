// Signed access tokens for order confirmation pages.
//
// The success page otherwise exposes full customer PII (name, email, phone,
// address) to anybody who learns or guesses an order id. Every order now gets
// an HMAC token that is appended to the success URL, and the page only renders
// the invoice when the token verifies.

import crypto from 'node:crypto';

function tokenSecret(): string {
  return (
    process.env.ORDER_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    'sdca-insecure-dev-order-token'
  );
}

export function createOrderToken(orderId: string): string {
  return crypto.createHmac('sha256', tokenSecret()).update(`order:${orderId}`).digest('hex').slice(0, 32);
}

export function verifyOrderToken(orderId: string | undefined, token: string | undefined): boolean {
  if (!orderId || !token) return false;
  const expected = createOrderToken(orderId);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import {
  getOrderById,
  updateOrderPaymentStatus,
  decrementProductStock,
  getSupabaseAdminClient,
} from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * Record a Stripe event id for idempotency.
 * Returns 'duplicate' when this event was already processed.
 * Degrades gracefully ('unavailable') if the stripe_events table has not been
 * created yet — run supabase/security-hardening.sql to enable full protection.
 */
async function recordStripeEvent(
  eventId: string,
  type: string,
  orderId: string | null
): Promise<'new' | 'duplicate' | 'unavailable'> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return 'unavailable';

  const { error } = await supabase
    .from('stripe_events')
    .insert([{ id: eventId, type, order_id: orderId }]);

  if (!error) return 'new';
  if ((error as { code?: string }).code === '23505') return 'duplicate';

  console.warn(
    'stripe_events unavailable — processing without idempotency guard:',
    error.message
  );
  return 'unavailable';
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 });
  }

  // ---- Signature verification (raw body) ----
  let event: any;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err?.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const session = event.data.object as any;
    const orderId: string | null = session?.metadata?.order_id || null;

    // ---- Idempotency: Stripe retries deliveries at least once ----
    const idempotency = await recordStripeEvent(event.id, event.type, orderId);
    if (idempotency === 'duplicate') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // ---- Payment completed ----
    if (event.type === 'checkout.session.completed') {
      if (!orderId) {
        console.error('Stripe webhook: checkout.session.completed without order_id metadata');
        return NextResponse.json({ received: true });
      }

      if (session.payment_status !== 'paid') {
        return NextResponse.json({ received: true, ignored: 'not_paid_yet' });
      }

      const order = await getOrderById(orderId);
      if (!order) {
        console.error(`Stripe webhook: order ${orderId} not found`);
        return NextResponse.json({ received: true });
      }

      if (order.payment_status === 'paid') {
        return NextResponse.json({ received: true, alreadyPaid: true });
      }

      // ---- Amount cross-check: never accept a session that charged a different total ----
      const expectedFils = Math.round(Number(order.total_amount) * 100);
      if (typeof session.amount_total === 'number' && session.amount_total !== expectedFils) {
        console.error(
          `Stripe webhook: amount mismatch for order ${orderId} — expected ${expectedFils}, paid ${session.amount_total}. Not marking as paid.`
        );
        return NextResponse.json({ received: true, ignored: 'amount_mismatch' });
      }

      const paid = await updateOrderPaymentStatus(orderId, 'paid', session.id);
      if (!paid) {
        console.error(`Stripe webhook: could not persist payment status for order ${orderId}`);
        return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
      }

      // NOTE: order_status is intentionally NOT modified here. The shop owner
      // controls fulfilment; a webhook must never regress a packed/shipped order.

      for (const item of order.items || []) {
        if (item.product_id) {
          const ok = await decrementProductStock(item.product_id, item.quantity);
          if (!ok) {
            console.error(
              `Stock decrement failed for product ${item.product_id} (order ${orderId}) — manual adjustment may be needed.`
            );
          }
        }
      }

      return NextResponse.json({ received: true });
    }

    // ---- Checkout session expired (customer abandoned card payment) ----
    if (event.type === 'checkout.session.expired') {
      if (orderId) {
        const order = await getOrderById(orderId);
        if (order && order.payment_status === 'pending') {
          await updateOrderPaymentStatus(orderId, 'failed');
        }
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook processing error:', err?.message);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getOrderById, updateOrderPaymentStatus, decrementProductStock, updateOrderStatus } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET missing' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 });
  }

  try {
    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const orderId = session.metadata?.order_id;

      if (orderId) {
        // Mark payment as paid
        await updateOrderPaymentStatus(orderId, 'paid', session.id);
        await updateOrderStatus(orderId, 'new');

        // Fetch order items and decrement stock
        const order = await getOrderById(orderId);
        if (order?.items) {
          for (const item of order.items) {
            if (item.product_id) {
              await decrementProductStock(item.product_id, item.quantity);
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook processing error:', err.message);
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }
}

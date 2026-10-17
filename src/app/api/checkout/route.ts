import { NextRequest, NextResponse } from 'next/server';
import { createOrder, decrementProductStock, updateOrderPaymentStatus } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      payment_method,
      items,
    } = body;

    // Validation
    if (!customer_name || !customer_email || !customer_phone || !shipping_address || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required customer or shipping details' },
        { status: 400 }
      );
    }

    if (!['card', 'cod'].includes(payment_method)) {
      return NextResponse.json(
        { error: 'Invalid payment method. Allowed: "card" or "cod"' },
        { status: 400 }
      );
    }

    // Compute total strictly from unit prices and quantities
    const total_amount = items.reduce(
      (sum: number, it: any) => sum + Number(it.price) * Number(it.quantity),
      0
    );

    // Format order items for database insertion
    const orderItems = items.map((it: any) => ({
      product_id: it.productId || null,
      product_title: it.title,
      unit_price: Number(it.price),
      quantity: Number(it.quantity),
      selected_options: it.selectedOptions || {},
    }));

    // 1. Create order record
    const newOrder = await createOrder(
      {
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        total_amount,
        payment_method,
        payment_status: 'pending',
        order_status: 'new',
        stripe_session_id: null,
      },
      orderItems
    );

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (req.headers.get('origin') ?? 'http://localhost:3000');

    // 2. Handle Cash on Delivery (COD)
    if (payment_method === 'cod') {
      // Decrement inventory stock
      for (const it of items) {
        if (it.productId) {
          await decrementProductStock(it.productId, it.quantity);
        }
      }

      return NextResponse.json({
        success: true,
        orderId: newOrder.id,
        redirectUrl: `/checkout/success?order_id=${newOrder.id}`,
      });
    }

    // 3. Handle Card Payment via Stripe Checkout API
    if (payment_method === 'card') {
      if (stripe) {
        // Build line items for Stripe Checkout Session
        const stripeLineItems = items.map((it: any) => ({
          price_data: {
            currency: 'aed',
            product_data: {
              name: it.title,
              description: it.selectedOptions
                ? Object.entries(it.selectedOptions)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ')
                : undefined,
            },
            unit_amount: Math.round(Number(it.price) * 100), // Stripe expects cents
          },
          quantity: Number(it.quantity),
        }));

        const sessionParams: any = {
          payment_method_types: ['card'],
          line_items: stripeLineItems,
          mode: 'payment',
          customer_email,
          metadata: {
            order_id: newOrder.id,
          },
          success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${newOrder.id}`,
          cancel_url: `${siteUrl}/checkout`,
        };

        const session = await stripe.checkout.sessions.create(sessionParams);

        // Save session ID on order
        await updateOrderPaymentStatus(newOrder.id, 'pending', session.id);

        return NextResponse.json({
          success: true,
          orderId: newOrder.id,
          redirectUrl: session.url,
        });
      } else {
        // Stripe credentials not configured (sandbox / test fallback)
        // Mark payment as paid for local test demonstration
        await updateOrderPaymentStatus(newOrder.id, 'paid', 'test_sandbox_session');
        for (const it of items) {
          if (it.productId) {
            await decrementProductStock(it.productId, it.quantity);
          }
        }

        return NextResponse.json({
          success: true,
          orderId: newOrder.id,
          redirectUrl: `/checkout/success?order_id=${newOrder.id}&sandbox=card_simulated`,
        });
      }
    }

    return NextResponse.json({ error: 'Unsupported flow' }, { status: 400 });
  } catch (error: any) {
    console.error('Checkout API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error processing checkout' },
      { status: 500 }
    );
  }
}

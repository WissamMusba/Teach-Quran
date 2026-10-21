import { NextRequest, NextResponse } from 'next/server';
import {
  createOrder,
  deleteOrder,
  decrementProductStock,
  incrementProductStock,
  updateOrderPaymentStatus,
  getProductById,
} from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';
import { createOrderToken } from '@/lib/orderToken';
import { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_LINE_ITEMS = 20;
const MAX_QTY_PER_ITEM = 50;

function sanitizeOptions(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (count >= 8) break;
    if (typeof v === 'string' && v.length <= 80) {
      out[String(k).slice(0, 40)] = v;
      count++;
    }
  }
  return out;
}

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
    } = body ?? {};

    // ------------------------------------------------------------------
    // 1. Validate customer details
    // ------------------------------------------------------------------
    const name = typeof customer_name === 'string' ? customer_name.trim() : '';
    const email = typeof customer_email === 'string' ? customer_email.trim() : '';
    const phone = typeof customer_phone === 'string' ? customer_phone.trim() : '';
    const address = shipping_address as Record<string, unknown> | null;

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const addressOk =
      address &&
      typeof address.street === 'string' &&
      address.street.trim().length > 0 &&
      typeof address.city === 'string' &&
      address.city.trim().length > 0 &&
      typeof address.country === 'string' &&
      address.country.trim().length > 0;

    if (!name || !emailOk || !phone || !addressOk) {
      return NextResponse.json(
        { error: 'Missing or invalid customer or shipping details.' },
        { status: 400 }
      );
    }

    if (!['cod', 'bank_transfer'].includes(payment_method)) {
      return NextResponse.json(
        { error: 'Card / Apple Pay is currently unavailable. Please select Direct Bank Transfer or Cash on Delivery.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINE_ITEMS) {
      return NextResponse.json(
        { error: `Your cart must contain between 1 and ${MAX_LINE_ITEMS} items.` },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // 2. Resolve every line item against the database — prices, stock and
    //    titles are server-authoritative. Client-supplied prices are ignored.
    // ------------------------------------------------------------------
    const resolved: {
      product: Product;
      quantity: number;
      selectedOptions: Record<string, string>;
    }[] = [];

    for (const raw of items) {
      const productId = typeof raw?.productId === 'string' ? raw.productId : '';
      const quantity = Number(raw?.quantity);

      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
        return NextResponse.json(
          { error: 'Invalid item quantity in cart. Quantities must be whole numbers between 1 and 50.' },
          { status: 400 }
        );
      }

      const product = await getProductById(productId);
      if (!product || !product.is_active) {
        return NextResponse.json(
          { error: `"${typeof raw?.title === 'string' ? raw.title : 'An item in your cart'}" is no longer available. Please review your cart.` },
          { status: 400 }
        );
      }

      if (product.stock_quantity < quantity) {
        return NextResponse.json(
          {
            error:
              product.stock_quantity > 0
                ? `Only ${product.stock_quantity} left in stock for "${product.title}". Please adjust the quantity.`
                : `"${product.title}" is out of stock. Please remove it from your cart.`,
          },
          { status: 409 }
        );
      }

      resolved.push({ product, quantity, selectedOptions: sanitizeOptions(raw?.selectedOptions) });
    }

    const total_amount = resolved.reduce(
      (sum, r) => sum + Number(r.product.price) * r.quantity,
      0
    );

    const orderItems = resolved.map((r) => ({
      product_id: r.product.id,
      product_title: r.product.title,
      unit_price: Number(r.product.price),
      quantity: r.quantity,
      selected_options: r.selectedOptions,
    }));

    // ------------------------------------------------------------------
    // 3. Create the order (pending) and build a signed confirmation URL
    // ------------------------------------------------------------------
    const newOrder = await createOrder(
      {
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        shipping_address: {
          street: String(address!.street).trim(),
          city: String(address!.city).trim(),
          state: typeof address!.state === 'string' ? address!.state.trim() : '',
          postal_code: typeof address!.postal_code === 'string' ? address!.postal_code.trim() : '',
          country: String(address!.country).trim(),
        },
        total_amount,
        payment_method,
        payment_status: 'pending',
        order_status: 'new',
        stripe_session_id: null,
      },
      orderItems
    );

    if (!newOrder) {
      return NextResponse.json(
        { error: 'We could not save your order. Please try again in a moment.' },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (req.headers.get('origin') ?? 'http://localhost:3000');

    const token = createOrderToken(newOrder.id);
    const bankTransferUrl = `${siteUrl}/checkout/bank-transfer?order_id=${newOrder.id}&token=${token}&total=${total_amount}`;
    const successUrl = `${siteUrl}/checkout/success?order_id=${newOrder.id}&token=${token}&pm=${payment_method}&total=${total_amount}`;

    // ------------------------------------------------------------------
    // 4a. Cash on Delivery or Direct Bank Transfer: reserve stock immediately
    // ------------------------------------------------------------------
    if (payment_method === 'cod' || payment_method === 'bank_transfer') {
      const reserved: { productId: string; quantity: number }[] = [];

      for (const r of resolved) {
        const ok = await decrementProductStock(r.product.id, r.quantity);
        if (!ok) {
          // Roll back anything already reserved and discard the orphan order.
          for (const done of reserved) {
            await incrementProductStock(done.productId, done.quantity);
          }
          await deleteOrder(newOrder.id);
          return NextResponse.json(
            {
              error: `Sorry — "${r.product.title}" just went out of stock. Please review your cart and try again.`,
            },
            { status: 409 }
          );
        }
        reserved.push({ productId: r.product.id, quantity: r.quantity });
      }

      return NextResponse.json({
        success: true,
        orderId: newOrder.id,
        redirectUrl: payment_method === 'bank_transfer' ? bankTransferUrl : successUrl,
      });
    }

    // ------------------------------------------------------------------
    // 4b. Card payment via Stripe Checkout
    // ------------------------------------------------------------------
    if (payment_method === 'card') {
      if (stripe) {
        const stripeLineItems = resolved.map((r) => ({
          price_data: {
            currency: 'aed',
            product_data: {
              name: r.product.title,
              description:
                Object.keys(r.selectedOptions).length > 0
                  ? Object.entries(r.selectedOptions)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' | ')
                  : undefined,
            },
            unit_amount: Math.round(Number(r.product.price) * 100), // Stripe expects fils
          },
          quantity: r.quantity,
        }));

        const sessionParams: any = {
          payment_method_types: ['card'],
          line_items: stripeLineItems,
          mode: 'payment',
          customer_email: email,
          metadata: {
            order_id: newOrder.id,
          },
          success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/checkout`,
        };

        const session = await stripe.checkout.sessions.create(sessionParams);
        await updateOrderPaymentStatus(newOrder.id, 'pending', session.id);

        return NextResponse.json({
          success: true,
          orderId: newOrder.id,
          redirectUrl: session.url,
        });
      }

      // Stripe is missing. Never give away goods: fail closed in production.
      if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
        await deleteOrder(newOrder.id);
        return NextResponse.json(
          {
            error:
              'Card payments are temporarily unavailable. Please choose Cash on Delivery or try again later.',
          },
          { status: 503 }
        );
      }

      // Local sandbox simulation (development only) — pays + reserves stock.
      await updateOrderPaymentStatus(newOrder.id, 'paid', 'test_sandbox_session');
      for (const r of resolved) {
        await decrementProductStock(r.product.id, r.quantity);
      }

      return NextResponse.json({
        success: true,
        orderId: newOrder.id,
        redirectUrl: `${successUrl}&sandbox=card_simulated`,
      });
    }

    return NextResponse.json({ error: 'Unsupported flow' }, { status: 400 });
  } catch (error: any) {
    console.error('Checkout API error:', error);
    return NextResponse.json(
      { error: 'Internal server error processing checkout. Please try again.' },
      { status: 500 }
    );
  }
}

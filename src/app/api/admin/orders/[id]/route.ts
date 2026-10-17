import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrderStatus, updateOrderPaymentStatus } from '@/lib/supabaseServer';
import { requireAdminApi } from '@/lib/adminGuard';
import { OrderStatus, PaymentStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const { id } = await params;
    const { status, payment_status } = await req.json();

    if (status === undefined && payment_status === undefined) {
      return NextResponse.json(
        { error: 'Provide a new order status and/or payment_status.' },
        { status: 400 }
      );
    }

    if (status !== undefined) {
      const allowed = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Invalid order status. Allowed: ${allowed.join(', ')}` },
          { status: 400 }
        );
      }
      const ok = await updateOrderStatus(id, status as OrderStatus);
      if (!ok) {
        return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
      }
    }

    if (payment_status !== undefined) {
      const allowedPayments = ['pending', 'paid', 'failed'];
      if (!allowedPayments.includes(payment_status)) {
        return NextResponse.json(
          { error: `Invalid payment status. Allowed: ${allowedPayments.join(', ')}` },
          { status: 400 }
        );
      }
      const ok = await updateOrderPaymentStatus(id, payment_status as PaymentStatus);
      if (!ok) {
        return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, status, payment_status });
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order.' }, { status: 500 });
  }
}

/**
 * Ziina UAE Payment Gateway Integration (v2 API)
 * Supports all Visa, Mastercard, and Apple Pay payments in AED.
 */

interface CreatePaymentIntentParams {
  amountAed: number;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

interface ZiinaPaymentIntentResponse {
  id: string;
  amount: number;
  currency_code: string;
  status: string;
  redirect_url: string;
}

export async function createZiinaPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<{ redirectUrl: string; intentId: string; isLive: boolean }> {
  const apiKey = process.env.ZIINA_API_KEY?.trim();

  // If no API key configured yet or placeholder, provide graceful fallback
  if (!apiKey || apiKey === 'ziina_test_placeholder' || apiKey.startsWith('placeholder')) {
    // Generate an illustrative/demo payment intent redirect so the user can inspect how it works
    const demoRef = params.orderId.slice(0, 8);
    const amountFils = Math.round(params.amountAed * 100);
    
    // In demo mode, redirect to success URL with payment status so checkout functions smoothly
    const simulatedRedirect = `${params.successUrl}&ziina_demo=1&amount_fils=${amountFils}&ref=${demoRef}`;
    return {
      redirectUrl: simulatedRedirect,
      intentId: `demo_${Date.now()}`,
      isLive: false,
    };
  }

  // Real Ziina v2 Payment Intent API
  const amountInFils = Math.round(params.amountAed * 100);

  const payload = {
    amount: amountInFils,
    currency_code: 'AED',
    message: `CG Sports Order #${params.orderId.slice(0, 8)}`,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    test: apiKey.startsWith('test_') || apiKey.includes('_test_'),
  };

  const response = await fetch('https://api-v2.ziina.com/api/payment_intent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Ziina API Error:', response.status, errorBody);
    throw new Error(
      `Ziina payment initiation failed (${response.status}). Please check your API key.`
    );
  }

  const data = (await response.json()) as ZiinaPaymentIntentResponse;

  if (!data.redirect_url) {
    throw new Error('Ziina did not return a valid payment redirect URL.');
  }

  return {
    redirectUrl: data.redirect_url,
    intentId: data.id,
    isLive: !payload.test,
  };
}

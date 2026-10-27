'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import {
  CreditCard,
  Truck,
  ShieldCheck,
  Lock,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Building2,
  ArrowRight,
} from 'lucide-react';

export default function CheckoutPage() {
  const { cart, totalAmount } = useCart();

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United Arab Emirates',
  });

  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'card' | 'cod'>('bank_transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  if (cart.length === 0) {
    return (
      <div className="bg-neutral-50 text-neutral-900 dark:bg-[#050505] dark:text-white min-h-[75vh] flex items-center justify-center py-16 px-4 transition-colors duration-200">
        <div className="max-w-md w-full bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-10 text-center space-y-5 shadow-sm dark:shadow-2xl">
          <h2 className="font-display uppercase text-2xl font-black text-black dark:text-white">Your Cart is Empty</h2>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
            You must add cricket gear to your cart before proceeding to checkout.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center w-full py-3.5 px-4 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-white font-black uppercase tracking-wider text-xs transition-colors shadow-orange-glow-sm"
          >
            Go to Shop
          </Link>
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          customer_phone: formData.customer_phone,
          shipping_address: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
          },
          payment_method: paymentMethod,
          items: cart,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize order');
      }

      if (!data.redirectUrl) {
        throw new Error(
          'We could not start the order session. Please try again or select Direct Bank Transfer.'
        );
      }

      window.location.href = data.redirectUrl;
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-neutral-50 text-neutral-900 dark:bg-[#050505] dark:text-white min-h-screen py-8 sm:py-12 pb-32 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/cart"
            className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-neutral-600 hover:text-[#FF5500] dark:text-neutral-400 dark:hover:text-[#FF5500] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Cart</span>
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center space-x-3.5 mb-8 pb-6 border-b border-neutral-200 dark:border-[#1C1C24]">
          <div className="w-10 h-10 rounded-xl bg-[#FF5500] text-white flex items-center justify-center font-bold shadow-orange-glow-sm shrink-0">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display uppercase text-2xl sm:text-4xl font-black text-black dark:text-white tracking-tight">
              Express Cricket Checkout
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Direct courier fulfillment across Ajman &amp; all UAE Emirates.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div role="alert" className="mb-8 p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Details & Payment Method */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Contact Details */}
            <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-6 sm:p-7 shadow-sm dark:shadow-xl space-y-5">
              <h2 className="font-display uppercase text-xl sm:text-2xl font-black text-black dark:text-white pb-3 border-b border-neutral-200 dark:border-[#1C1C24] flex items-center justify-between">
                <span>1. Customer Details</span>
                <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Step 1 of 3
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="customer_name" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Full Name *
                  </label>
                  <input
                    id="customer_name"
                    type="text"
                    name="customer_name"
                    required
                    autoComplete="name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    placeholder="e.g. Tariq Mehmood"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="customer_email" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Email Address *
                  </label>
                  <input
                    id="customer_email"
                    type="email"
                    name="customer_email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={formData.customer_email}
                    onChange={handleInputChange}
                    placeholder="tariq@example.com"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="customer_phone" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Phone / WhatsApp Number *
                  </label>
                  <input
                    id="customer_phone"
                    type="tel"
                    name="customer_phone"
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    value={formData.customer_phone}
                    onChange={handleInputChange}
                    placeholder="055 000 0000"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* 2. Shipping Address */}
            <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-6 sm:p-7 shadow-sm dark:shadow-xl space-y-5">
              <h2 className="font-display uppercase text-xl sm:text-2xl font-black text-black dark:text-white pb-3 border-b border-neutral-200 dark:border-[#1C1C24] flex items-center justify-between">
                <span>2. Delivery Address</span>
                <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Step 2 of 3
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="street" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Street Address &amp; Villa/Apartment *
                  </label>
                  <input
                    id="street"
                    type="text"
                    name="street"
                    required
                    autoComplete="address-line1"
                    value={formData.street}
                    onChange={handleInputChange}
                    placeholder="Villa 12, Street 4, Al Rashidiya"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="city" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    City / Area *
                  </label>
                  <input
                    id="city"
                    type="text"
                    name="city"
                    required
                    autoComplete="address-level2"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Ajman / Dubai"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Emirate *
                  </label>
                  <select
                    id="state"
                    name="state"
                    required
                    value={formData.state || 'Ajman'}
                    onChange={handleInputChange}
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white focus:outline-none focus:border-[#FF5500] font-bold"
                  >
                    <option value="Ajman">Ajman</option>
                    <option value="Dubai">Dubai</option>
                    <option value="Sharjah">Sharjah</option>
                    <option value="Abu Dhabi">Abu Dhabi</option>
                    <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                    <option value="Fujairah">Fujairah</option>
                    <option value="Umm Al Quwain">Umm Al Quwain</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="country" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Country *
                  </label>
                  <input
                    id="country"
                    type="text"
                    name="country"
                    readOnly
                    value="United Arab Emirates"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-100 dark:bg-[#1A1A22] text-neutral-700 dark:text-neutral-300 font-bold"
                  />
                </div>

                <div>
                  <label htmlFor="postal_code" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Postal Code (Optional)
                  </label>
                  <input
                    id="postal_code"
                    type="text"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleInputChange}
                    placeholder="00000"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* 3. Payment Method Selector */}
            <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-6 sm:p-7 shadow-sm dark:shadow-xl space-y-5">
              <h2 className="font-display uppercase text-xl sm:text-2xl font-black text-black dark:text-white pb-3 border-b border-neutral-200 dark:border-[#1C1C24] flex items-center justify-between">
                <span>3. Payment Method</span>
                <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Step 3 of 3
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 1. Direct Bank Wire Transfer */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPaymentMethod('bank_transfer')}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setPaymentMethod('bank_transfer');
                    }
                  }}
                  className={`relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'bank_transfer'
                      ? 'border-[#FF5500] bg-[#FF5500]/10 shadow-orange-glow-sm ring-1 ring-[#FF5500]'
                      : 'border-neutral-200 dark:border-[#252530] hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50 dark:bg-[#121218]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 font-display uppercase tracking-wide font-bold text-base text-black dark:text-white">
                      <Building2 className="w-5 h-5 text-[#FF5500] shrink-0" />
                      <span>Bank Transfer</span>
                    </div>
                    {/* Visual Radio Circle */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-[#FF5500] bg-[#FF5500]'
                          : 'border-neutral-400 dark:border-neutral-600'
                      }`}
                    >
                      {paymentMethod === 'bank_transfer' && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 flex-1">
                    Emirates Islamic transfer. Dedicated invoice with Reference Code on next page.
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-wider uppercase text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      Recommended
                    </span>
                    <span className="text-[10px] font-black uppercase text-[#FF5500]">
                      0% Fee
                    </span>
                  </div>
                </div>

                {/* 2. Card / Apple Pay (via Ziina) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPaymentMethod('card')}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setPaymentMethod('card');
                    }
                  }}
                  className={`relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'card'
                      ? 'border-[#FF5500] bg-[#FF5500]/10 shadow-orange-glow-sm ring-1 ring-[#FF5500]'
                      : 'border-neutral-200 dark:border-[#252530] hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50 dark:bg-[#121218]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 font-display uppercase tracking-wide font-bold text-base text-black dark:text-white">
                      <CreditCard className="w-5 h-5 text-[#FF5500] shrink-0" />
                      <span>Card / Apple Pay</span>
                    </div>
                    {/* Visual Radio Circle */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        paymentMethod === 'card'
                          ? 'border-[#FF5500] bg-[#FF5500]'
                          : 'border-neutral-400 dark:border-neutral-600'
                      }`}
                    >
                      {paymentMethod === 'card' && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 flex-1">
                    Visa, Mastercard &amp; Apple Pay via Ziina UAE.
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-wider uppercase text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                      Instant Approval
                    </span>
                    <span className="text-[10px] font-bold text-neutral-500">
                      All Cards
                    </span>
                  </div>
                </div>

                {/* 3. Cash on Delivery */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPaymentMethod('cod')}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setPaymentMethod('cod');
                    }
                  }}
                  className={`relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-[#FF5500] bg-[#FF5500]/10 shadow-orange-glow-sm ring-1 ring-[#FF5500]'
                      : 'border-neutral-200 dark:border-[#252530] hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50 dark:bg-[#121218]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 font-display uppercase tracking-wide font-bold text-base text-black dark:text-white">
                      <Truck className="w-5 h-5 text-[#FF5500] shrink-0" />
                      <span>Cash on Delivery</span>
                    </div>
                    {/* Visual Radio Circle */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        paymentMethod === 'cod'
                          ? 'border-[#FF5500] bg-[#FF5500]'
                          : 'border-neutral-400 dark:border-neutral-600'
                      }`}
                    >
                      {paymentMethod === 'cod' && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 flex-1">
                    Pay in cash when parcel is handed over by the courier.
                  </p>
                  <div className="mt-3">
                    <span className="text-[10px] font-black tracking-wider uppercase text-neutral-500 dark:text-neutral-400">
                      UAE Delivery Only
                    </span>
                  </div>
                </div>
              </div>

              {/* Informative Note for Bank Transfer */}
              {paymentMethod === 'bank_transfer' && (
                <div className="p-4 rounded-2xl bg-[#FF5500]/10 border border-[#FF5500]/30 flex items-start space-x-3 text-xs text-neutral-700 dark:text-neutral-300 animate-fade-in">
                  <Building2 className="w-5 h-5 text-[#FF5500] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-black dark:text-white block font-bold mb-0.5">
                      How Bank Transfer Works
                    </strong>
                    <span>
                      After clicking below, you will instantly receive your unique <strong>Reference Code</strong> along with Emirates Islamic IBAN &amp; account details, a 24-hour reservation lock, and direct receipt submission / WhatsApp confirmation.
                    </span>
                  </div>
                </div>
              )}

              {/* Informative Note for Card / Apple Pay (Ziina) */}
              {paymentMethod === 'card' && (
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-start space-x-3 text-xs text-neutral-700 dark:text-neutral-300 animate-fade-in">
                  <CreditCard className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-black dark:text-white block font-bold mb-0.5">
                      Fast &amp; Secure Card / Apple Pay via Ziina UAE
                    </strong>
                    <span>
                      You will be securely redirected to Ziina to complete payment with any UAE or international <strong>Visa, Mastercard, or 1-tap Apple Pay</strong>. Your order is confirmed immediately.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Complete Checkout Primary Action (Ergonomic, No Scrolling Required) */}
            <div className="bg-white dark:bg-[#0E0E14] border-2 border-[#FF5500]/70 rounded-3xl p-6 sm:p-7 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-200 dark:border-[#1C1C24]">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#FF5500] block">
                    Fast Checkout Step
                  </span>
                  <h3 className="font-display uppercase text-lg sm:text-xl font-black text-black dark:text-white">
                    {paymentMethod === 'bank_transfer'
                      ? 'Proceed to Bank Transfer Instructions'
                      : paymentMethod === 'card'
                        ? 'Proceed to Card / Apple Pay'
                        : 'Confirm Cash on Delivery'}
                  </h3>
                </div>
                <div className="flex items-baseline space-x-1.5 self-start sm:self-auto">
                  <span className="text-xs font-black text-[#FF5500]">AED</span>
                  <span className="font-display text-3xl font-black text-black dark:text-white">
                    {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !agreedToTerms}
                className="w-full py-4 px-6 bg-[#FF5500] hover:bg-[#FF6600] disabled:bg-neutral-300 dark:disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black uppercase tracking-widest rounded-xl text-xs sm:text-sm transition-all shadow-orange-glow flex items-center justify-center space-x-2.5 active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>Processing Order...</span>
                  </>
                ) : paymentMethod === 'bank_transfer' ? (
                  <>
                    <span>Proceed to Bank Transfer Details</span>
                    <ArrowRight className="w-5 h-5 text-white" />
                  </>
                ) : paymentMethod === 'card' ? (
                  <>
                    <span>Pay AED {totalAmount.toLocaleString()} via Card / Apple Pay</span>
                    <ArrowRight className="w-5 h-5 text-white" />
                  </>
                ) : (
                  <>
                    <span>Place Cash on Delivery Order</span>
                    <ArrowRight className="w-5 h-5 text-white" />
                  </>
                )}
              </button>

              <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500 gap-2 pt-1">
                <span>
                  By placing your order, you agree to our{' '}
                  <Link href="/terms" className="text-[#FF5500] hover:underline font-bold">Terms</Link> and{' '}
                  <Link href="/privacy" className="text-[#FF5500] hover:underline font-bold">Privacy</Link>.
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {paymentMethod === 'bank_transfer' ? '24-Hour Stock Reservation' : 'Instant Order Dispatch'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Order Review (Sticky & Clean) */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-6 shadow-md dark:shadow-2xl space-y-5 sticky top-24">
              <h3 className="font-display uppercase text-xl sm:text-2xl font-black text-black dark:text-white pb-3 border-b border-neutral-200 dark:border-[#1C1C24]">
                Order Summary ({cart.length})
              </h3>

              {/* Items Summary */}
              <div className="max-h-52 overflow-y-auto space-y-2.5 divide-y divide-neutral-200 dark:divide-[#1C1C24] pr-1">
                {cart.map((item, i) => (
                  <div key={i} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <p className="font-bold text-black dark:text-white line-clamp-1">{item.title}</p>
                      <p className="text-neutral-500 dark:text-neutral-400">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-bold text-black dark:text-white font-mono">
                      AED {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-neutral-200 dark:border-[#1C1C24] pt-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span className="uppercase tracking-wider font-bold">Subtotal</span>
                  <span className="font-bold text-black dark:text-white font-mono text-sm">AED {totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span className="uppercase tracking-wider font-bold">Tracked Courier</span>
                  <span className="font-bold text-[#FF5500] uppercase font-mono">FREE</span>
                </div>
                <div className="border-t border-neutral-200 dark:border-[#1C1C24] pt-3 flex justify-between items-baseline">
                  <span className="font-display uppercase text-base font-black text-black dark:text-white">Total</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-sm font-black text-[#FF5500]">AED</span>
                    <span className="font-display text-3xl font-black text-black dark:text-white">
                      {totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms Agreement */}
              <label className="flex items-start space-x-2.5 text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-[#FF5500] focus:ring-[#FF5500]"
                />
                <span>
                  I agree to the{' '}
                  <Link href="/terms" className="text-[#FF5500] hover:underline font-bold">
                    Terms
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-[#FF5500] hover:underline font-bold">
                    Privacy Policy
                  </Link>.
                </span>
              </label>

              {/* Action Button */}
              <button
                type="submit"
                disabled={isSubmitting || !agreedToTerms}
                className="w-full py-4 px-4 bg-[#FF5500] hover:bg-[#FF6600] disabled:bg-neutral-300 dark:disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all shadow-orange-glow flex items-center justify-center space-x-2 active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Processing Order...</span>
                  </>
                ) : paymentMethod === 'bank_transfer' ? (
                  <>
                    <span>Proceed to Bank Transfer Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : paymentMethod === 'card' ? (
                  <span>Pay by Card — AED {totalAmount.toLocaleString()}</span>
                ) : (
                  <span>Place COD Order — AED {totalAmount.toLocaleString()}</span>
                )}
              </button>

              <div className="text-center text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-center space-x-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>SSL 256-Bit Encrypted Checkout</span>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Floating Ergonomic Mobile Bottom Action Bar: Always reachable without scrolling */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 dark:bg-[#0A0A0E]/95 backdrop-blur-xl border-t border-neutral-200 dark:border-[#1C1C24] p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.15)] safe-pb">
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <div>
            <span className="text-[10px] font-black uppercase text-neutral-500 block">Total Due</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xs font-black text-[#FF5500]">AED</span>
              <span className="font-display text-xl font-black text-black dark:text-white">
                {totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const form = document.querySelector('form');
              if (form) {
                if (!form.checkValidity()) {
                  form.reportValidity();
                  return;
                }
                form.requestSubmit();
              }
            }}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 bg-[#FF5500] hover:bg-[#FF6600] disabled:bg-neutral-800 text-white font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-orange-glow active:scale-95 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : paymentMethod === 'bank_transfer' ? (
              <>
                <span>Bank Transfer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : paymentMethod === 'card' ? (
              <span>Pay by Card</span>
            ) : (
              <span>Place COD Order</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

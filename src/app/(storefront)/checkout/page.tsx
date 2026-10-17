'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { CreditCard, Truck, ShieldCheck, Lock, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

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

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cod'>('card');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

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

      // Redirect to the Stripe checkout session or the signed COD
      // confirmation page. The cart is only cleared on the confirmation
      // page, after the order token verifies — never before payment
      // completes, so an abandoned payment does not wipe the cart.
      if (!data.redirectUrl) {
        throw new Error(
          'We could not start the payment session. Please try again or choose Cash on Delivery.'
        );
      }
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-neutral-50 text-neutral-900 dark:bg-[#050505] dark:text-white min-h-screen py-12 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <div className="mb-8">
          <Link
            href="/cart"
            className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-neutral-600 hover:text-[#FF5500] dark:text-neutral-400 dark:hover:text-[#FF5500] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Cart</span>
          </Link>
        </div>

        <div className="flex items-center space-x-3.5 mb-10 pb-6 border-b border-neutral-200 dark:border-[#1C1C24]">
          <div className="w-10 h-10 rounded-xl bg-[#FF5500] text-white flex items-center justify-center font-bold shadow-orange-glow-sm">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-black dark:text-white tracking-tight">
              Secure Cricket Checkout
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Encrypted transaction. Direct courier fulfillment with tracking.
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
          {/* Customer & Shipping Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Details */}
            <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-7 shadow-sm dark:shadow-xl space-y-5">
              <h2 className="font-display uppercase text-2xl font-black text-black dark:text-white pb-3 border-b border-neutral-200 dark:border-[#1C1C24] flex items-center justify-between">
                <span>1. Customer Details</span>
                <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Order updates
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label htmlFor="customer_name" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
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
                    placeholder="e.g. Michael Clarke"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="customer_email" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
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
                    placeholder="michael@example.com"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="customer_phone" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                    Phone Number *
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
                    placeholder="+971 50 000 0000"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-7 shadow-sm dark:shadow-xl space-y-5">
              <h2 className="font-display uppercase text-2xl font-black text-black dark:text-white pb-3 border-b border-neutral-200 dark:border-[#1C1C24] flex items-center justify-between">
                <span>2. Physical Shipping Destination</span>
                <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Street delivery
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label htmlFor="street" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                    Street Address &amp; House/Apartment *
                  </label>
                  <input
                    id="street"
                    type="text"
                    name="street"
                    required
                    autoComplete="address-line1"
                    value={formData.street}
                    onChange={handleInputChange}
                    placeholder="Villa 12, Street 4, Al Barsha 1"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="city" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                    City *
                  </label>
                  <input
                    id="city"
                    type="text"
                    name="city"
                    required
                    autoComplete="address-level2"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Dubai"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                    State / Province (Emirate) *
                  </label>
                  <input
                    id="state"
                    type="text"
                    name="state"
                    required
                    autoComplete="address-level1"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="Dubai"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="postal_code" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                    Postal / ZIP Code (optional)
                  </label>
                  <input
                    id="postal_code"
                    type="text"
                    name="postal_code"
                    autoComplete="postal-code"
                    value={formData.postal_code}
                    onChange={handleInputChange}
                    placeholder="00000"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="country" className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                    Country *
                  </label>
                  <select
                    id="country"
                    name="country"
                    autoComplete="country-name"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full text-xs px-4 py-3 rounded-xl border border-neutral-300 dark:border-[#272730] bg-neutral-50 dark:bg-[#14141B] text-black dark:text-white focus:outline-none focus:border-[#FF5500] font-bold"
                  >
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="Oman">Oman</option>
                    <option value="Qatar">Qatar</option>
                    <option value="Kuwait">Kuwait</option>
                    <option value="Bahrain">Bahrain</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Australia">Australia</option>
                    <option value="India">India</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="Sri Lanka">Sri Lanka</option>
                    <option value="South Africa">South Africa</option>
                    <option value="New Zealand">New Zealand</option>
                    <option value="Canada">Canada</option>
                    <option value="United States">United States</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-7 shadow-sm dark:shadow-xl space-y-5">
              <h2 className="font-display uppercase text-2xl font-black text-black dark:text-white pb-3 border-b border-neutral-200 dark:border-[#1C1C24]">
                3. Payment Method
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stripe Card */}
                <label
                  className={`relative flex flex-col p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'card'
                      ? 'border-[#FF5500] bg-[#FF5500]/10 shadow-orange-glow-sm'
                      : 'border-neutral-200 dark:border-[#252530] hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50 dark:bg-[#121218]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2.5 font-display uppercase tracking-wide font-bold text-lg text-black dark:text-white">
                      <CreditCard className="w-5 h-5 text-[#FF5500]" />
                      <span>Credit / Debit Card</span>
                    </div>
                    <input
                      type="radio"
                      name="payment_method"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                      className="text-[#FF5500] focus:ring-[#FF5500]"
                    />
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                    Visa, Mastercard, Apple Pay processed securely via Stripe Checkout session.
                  </p>
                </label>

                {/* Cash on Delivery */}
                <label
                  className={`relative flex flex-col p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-[#FF5500] bg-[#FF5500]/10 shadow-orange-glow-sm'
                      : 'border-neutral-200 dark:border-[#252530] hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50 dark:bg-[#121218]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2.5 font-display uppercase tracking-wide font-bold text-lg text-black dark:text-white">
                      <Truck className="w-5 h-5 text-[#FF5500]" />
                      <span>Cash on Delivery</span>
                    </div>
                    <input
                      type="radio"
                      name="payment_method"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="text-[#FF5500] focus:ring-[#FF5500]"
                    />
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                    Pay in cash when your cricket equipment parcel is handed over by the courier.
                  </p>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Order Review */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-6 shadow-md dark:shadow-2xl space-y-6 sticky top-28">
              <h3 className="font-display uppercase text-2xl font-black text-black dark:text-white pb-4 border-b border-neutral-200 dark:border-[#1C1C24]">
                Order Review ({cart.length} item{cart.length > 1 ? 's' : ''})
              </h3>

              {/* Items Summary */}
              <div className="max-h-60 overflow-y-auto space-y-3 divide-y divide-neutral-200 dark:divide-[#1C1C24] pr-1">
                {cart.map((item, i) => (
                  <div key={i} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
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
              <div className="border-t border-neutral-200 dark:border-[#1C1C24] pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span className="uppercase tracking-wider font-bold">Subtotal</span>
                  <span className="font-bold text-black dark:text-white font-mono text-sm">AED {totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span className="uppercase tracking-wider font-bold">Tracked Courier</span>
                  <span className="font-bold text-[#FF5500] uppercase">FREE</span>
                </div>
                <div className="border-t border-neutral-200 dark:border-[#1C1C24] pt-3 flex justify-between items-baseline">
                  <span className="font-display uppercase text-lg font-black text-black dark:text-white">Total Amount</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-sm font-black text-[#FF5500]">AED</span>
                    <span className="font-display text-4xl font-black text-black dark:text-white">
                      {totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms Agreement */}
              <label className="flex items-start space-x-3 text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer">
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
                    Terms of Service
                  </Link>
                  ,{' '}
                  <Link href="/returns" className="text-[#FF5500] hover:underline font-bold">
                    Returns Policy
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-[#FF5500] hover:underline font-bold">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !agreedToTerms}
                className="w-full py-4 px-4 bg-[#FF5500] hover:bg-[#FF6600] disabled:bg-neutral-300 dark:disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all shadow-orange-glow flex items-center justify-center space-x-2 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Processing Order...</span>
                  </>
                ) : paymentMethod === 'card' ? (
                  <span>Pay by Card — AED {totalAmount.toLocaleString()}</span>
                ) : (
                  <span>Place COD Order — AED {totalAmount.toLocaleString()}</span>
                )}
              </button>

              <div className="text-center text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-center space-x-1.5 pt-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>SSL 256-Bit Encrypted Checkout</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

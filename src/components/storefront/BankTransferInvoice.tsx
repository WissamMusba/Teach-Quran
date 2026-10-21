'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  Building2,
  UploadCloud,
  FileCheck2,
  Clock,
  Zap,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { SDCA_BANK_DETAILS } from '@/lib/bankDetails';
import { Order } from '@/lib/types';

interface BankTransferInvoiceProps {
  order: Order;
}

export default function BankTransferInvoice({ order }: BankTransferInvoiceProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Clean reference code (ORD-XXXXX)
  const rawId = String(order.id || '');
  const refCode = rawId.startsWith('ORD-')
    ? rawId
    : `ORD-${rawId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('receipt', file);
    formData.append('order_id', refCode);

    try {
      const res = await fetch('/api/upload-receipt', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      setReceiptUrl(data.receiptUrl || 'uploaded');
    } catch (err: any) {
      setUploadError(err.message || 'Could not upload file. You can share it via WhatsApp.');
    } finally {
      setUploading(false);
    }
  };

  const formattedAmount = Number(order.total_amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const whatsappMessage = encodeURIComponent(
    `Paid AED ${formattedAmount} for Order #${refCode}`
  );
  const whatsappUrl = `https://wa.me/971552317221?text=${whatsappMessage}`;

  return (
    <div className="space-y-6">
      {/* 1. TOP BOX: Order Placed + Critical Narration Reference */}
      <div className="bg-white dark:bg-[#0E0E14] border-2 border-[#FF5500] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF5500]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-[#22222E]">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Awaiting Bank Transfer</span>
            </div>
            <h1 className="font-display uppercase text-2xl sm:text-4xl font-black text-black dark:text-white tracking-tight">
              Order #{refCode} Placed
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Please transfer the exact total to complete your order.
            </p>
          </div>

          <div className="sm:text-right bg-neutral-50 dark:bg-[#14141D] p-4 rounded-2xl border border-neutral-200 dark:border-[#242434] sm:min-w-[180px]">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block">
              Total Amount
            </span>
            <div className="flex items-baseline space-x-1 sm:justify-end mt-0.5">
              <span className="text-xs font-black text-[#FF5500]">AED</span>
              <span className="font-display text-3xl sm:text-4xl font-black text-black dark:text-white">
                {formattedAmount}
              </span>
            </div>
          </div>
        </div>

        {/* [!] CRITICAL: Include this in transfer remarks */}
        <div className="mt-6 bg-[#FF5500]/10 border-2 border-[#FF5500] rounded-2xl p-5 sm:p-6 text-black dark:text-white">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#FF5500] text-white flex items-center justify-center font-black shrink-0 mt-0.5 shadow-orange-glow-sm">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="font-display uppercase text-sm sm:text-base font-black tracking-wide text-red-600 dark:text-[#FF7733]">
                CRITICAL: Include This In Your Transfer Remarks / Narration
              </h2>
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                Banks do not automatically link your name to the order. Enter this reference code in your bank&apos;s <strong>Remarks</strong>, <strong>Description</strong>, or <strong>Narration</strong> field:
              </p>
            </div>
          </div>

          {/* Large Copyable Reference Code Box */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#08080C] p-4 rounded-xl border border-neutral-300 dark:border-[#2A2A38]">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                Reference Code:
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-black dark:text-white select-all">
                {refCode}
              </span>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(refCode, 'refCode')}
              className={`inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer ${
                copiedKey === 'refCode'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#FF5500] hover:bg-[#FF6600] text-white shadow-orange-glow-sm'
              }`}
            >
              {copiedKey === 'refCode' ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Copied Reference!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white" />
                  <span>Copy Reference</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. BANK DETAILS CARD with Individual [Copy] Buttons */}
      <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-neutral-200 dark:border-[#1E1E28]">
          <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-[#181822] text-[#FF5500] flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display uppercase text-lg sm:text-xl font-black text-black dark:text-white">
              Emirates Islamic Bank Account Details
            </h2>
            <p className="text-xs text-neutral-500">
              Transfer locally in UAE via Mobile Banking app, Online Banking, or ATM.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Bank Name */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-neutral-50 dark:bg-[#13131A] border border-neutral-200 dark:border-[#20202C] gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                Bank Name
              </span>
              <span className="text-sm font-bold text-black dark:text-white">
                {SDCA_BANK_DETAILS.bankName} Bank
              </span>
            </div>
            <span className="text-xs font-semibold text-neutral-500">United Arab Emirates</span>
          </div>

          {/* Beneficiary Name */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-neutral-50 dark:bg-[#13131A] border border-neutral-200 dark:border-[#20202C] gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                Beneficiary Name / Account Title
              </span>
              <span className="text-base font-black text-black dark:text-white select-all">
                {SDCA_BANK_DETAILS.accountTitle}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(SDCA_BANK_DETAILS.accountTitle, 'beneficiary')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all self-start sm:self-auto ${
                copiedKey === 'beneficiary'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-200 hover:bg-neutral-300 dark:bg-[#20202C] dark:hover:bg-[#2C2C3C] text-black dark:text-white'
              }`}
            >
              {copiedKey === 'beneficiary' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* IBAN */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-neutral-50 dark:bg-[#13131A] border border-neutral-200 dark:border-[#20202C] gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                IBAN Number
              </span>
              <span className="text-sm sm:text-base font-mono font-black text-black dark:text-white select-all break-all">
                {SDCA_BANK_DETAILS.iban}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(SDCA_BANK_DETAILS.ibanClean, 'iban')}
              className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 self-start sm:self-auto ${
                copiedKey === 'iban'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#FF5500] hover:bg-[#FF6600] text-white shadow-orange-glow-sm'
              }`}
            >
              {copiedKey === 'iban' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied IBAN</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy IBAN</span>
                </>
              )}
            </button>
          </div>

          {/* Account Number */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-neutral-50 dark:bg-[#13131A] border border-neutral-200 dark:border-[#20202C] gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                Account Number
              </span>
              <span className="text-base font-mono font-bold text-black dark:text-white select-all">
                {SDCA_BANK_DETAILS.accountNumber}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(SDCA_BANK_DETAILS.accountNumber, 'acc')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all self-start sm:self-auto ${
                copiedKey === 'acc'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-200 hover:bg-neutral-300 dark:bg-[#20202C] dark:hover:bg-[#2C2C3C] text-black dark:text-white'
              }`}
            >
              {copiedKey === 'acc' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* SWIFT & Routing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-[#13131A] border border-neutral-200 dark:border-[#20202C]">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                  SWIFT Code
                </span>
                <span className="text-xs font-mono font-bold text-black dark:text-white select-all">
                  {SDCA_BANK_DETAILS.swiftCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(SDCA_BANK_DETAILS.swiftCode, 'swift')}
                className={`p-1.5 rounded-md text-xs ${
                  copiedKey === 'swift' ? 'text-emerald-500' : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
                title="Copy SWIFT"
              >
                {copiedKey === 'swift' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-[#13131A] border border-neutral-200 dark:border-[#20202C]">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                  Routing / Clearing Code
                </span>
                <span className="text-xs font-mono font-bold text-black dark:text-white select-all">
                  {SDCA_BANK_DETAILS.routingNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(SDCA_BANK_DETAILS.routingNumber, 'routing')}
                className={`p-1.5 rounded-md text-xs ${
                  copiedKey === 'routing' ? 'text-emerald-500' : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
                title="Copy Routing"
              >
                {copiedKey === 'routing' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PROOF OF PAYMENT SUBMISSION (Upload Receipt OR WhatsApp) */}
      <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl space-y-6">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-[#FF5500]">
            Step 2: Submit Proof of Payment
          </span>
          <h2 className="font-display uppercase text-xl sm:text-2xl font-black text-black dark:text-white mt-1">
            Upload Transfer Receipt or Share on WhatsApp
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            Once you make the transfer in your bank app, attach your receipt screenshot below or send it via WhatsApp.
          </p>
        </div>

        {/* Upload File Input */}
        <div className="bg-neutral-50 dark:bg-[#13131C] border-2 border-dashed border-neutral-300 dark:border-[#2A2A38] rounded-2xl p-6 text-center space-y-3">
          {receiptUrl ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-center space-x-2">
              <FileCheck2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span className="font-bold">
                Transfer receipt uploaded successfully! Our dispatch team will verify and process your shipment.
              </span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1E1E28] text-[#FF5500] flex items-center justify-center mx-auto shadow-sm">
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF5500]" />
                ) : (
                  <UploadCloud className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-black dark:text-white">
                  Upload Bank Transfer Screenshot or PDF Receipt
                </p>
                <p className="text-[11px] text-neutral-500">Supports PNG, JPG, JPEG, WEBP or PDF (Max 10MB)</p>
              </div>

              <div>
                <label className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-black font-black uppercase tracking-wider text-xs transition-colors cursor-pointer shadow-sm">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <span>{uploading ? 'Uploading Receipt...' : 'Choose Receipt File'}</span>
                </label>
              </div>

              {uploadError && (
                <p className="text-xs text-red-500 font-bold pt-1">{uploadError}</p>
              )}
            </>
          )}
        </div>

        {/* -- OR -- Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-neutral-200 dark:border-[#20202C] w-full" />
          <span className="bg-white dark:bg-[#0E0E14] px-4 text-xs font-black uppercase tracking-widest text-neutral-400 shrink-0">
            — OR —
          </span>
          <div className="border-t border-neutral-200 dark:border-[#20202C] w-full" />
        </div>

        {/* WhatsApp Pre-Filled Button */}
        <div>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20BA5A] text-white font-black uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transition-all cursor-pointer"
          >
            {/* WhatsApp SVG Icon */}
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.043.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z" />
            </svg>
            <span>Share Receipt on WhatsApp (0552317221)</span>
          </a>
          <p className="text-center text-[11px] text-neutral-500 mt-2 font-mono">
            Pre-filled with: &quot;Paid AED {formattedAmount} for Order #{refCode}&quot;
          </p>
        </div>
      </div>

      {/* 4. IMPORTANT OPERATIONAL NOTICES: 24h HOLD & TRANSFER RAILS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 24-Hour Inventory Reservation */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300 font-display uppercase font-black text-xs sm:text-sm">
            <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>24-Hour Hold Window</span>
          </div>
          <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
            Please complete your bank transfer within <strong>24 hours</strong> to secure your cricket gear reservation. Orders not confirmed within 24 hours are automatically cancelled to release stock.
          </p>
        </div>

        {/* Transfer Rails Notice (Instant Aani vs Standard UAEFTS) */}
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/60 rounded-2xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300 font-display uppercase font-black text-xs sm:text-sm">
            <Zap className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>Transfer Rails &amp; Timing</span>
          </div>
          <p className="text-xs text-blue-900/90 dark:text-blue-200/90 leading-relaxed">
            Transfers from <strong>Emirates Islamic</strong> accounts arrive instantly. Transfers from other UAE banks take up to <strong>1 business day</strong> unless sent via <strong>Instant Payment (Aani / UAEFTS)</strong>.
          </p>
        </div>
      </div>

      {/* 5. ORDER DETAILS SUMMARY */}
      <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl space-y-5">
        <h3 className="font-display uppercase text-lg sm:text-xl font-black text-black dark:text-white pb-3 border-b border-neutral-200 dark:border-[#1E1E28]">
          Order Summary &amp; Delivery Destination
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#13131A] border border-neutral-200 dark:border-[#20202C]">
            <span className="text-[10px] font-black uppercase text-neutral-500 block mb-1">
              Customer Details
            </span>
            <p className="font-bold text-black dark:text-white text-sm">{order.customer_name}</p>
            <p className="text-neutral-600 dark:text-neutral-400">{order.customer_email}</p>
            <p className="text-neutral-600 dark:text-neutral-400 font-mono">{order.customer_phone}</p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#13131A] border border-neutral-200 dark:border-[#20202C]">
            <span className="text-[10px] font-black uppercase text-neutral-500 block mb-1">
              Delivery Address
            </span>
            <p className="font-bold text-black dark:text-white text-sm">{order.shipping_address?.street}</p>
            <p className="text-neutral-600 dark:text-neutral-400">
              {order.shipping_address?.city}, {order.shipping_address?.state || 'UAE'}
            </p>
            <p className="text-neutral-600 dark:text-neutral-400 font-semibold">
              {order.shipping_address?.country || 'United Arab Emirates'}
            </p>
          </div>
        </div>

        {order.items && order.items.length > 0 && (
          <div className="border border-neutral-200 dark:border-[#202028] rounded-2xl overflow-hidden mt-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 dark:bg-[#161620] text-neutral-700 dark:text-neutral-400 font-bold uppercase tracking-wider border-b border-neutral-200 dark:border-[#202028]">
                <tr>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-[#202028]">
                {order.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-4 font-bold text-black dark:text-white">
                      {it.product_title}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-black dark:text-white">
                      {it.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-600 dark:text-neutral-400">
                      AED {it.unit_price}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-black dark:text-white">
                      AED {it.unit_price * it.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-neutral-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>CG Sports Verified Bank Transfer Processing</span>
          </div>

          <Link
            href="/shop"
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-[#181824] dark:hover:bg-[#202030] text-black dark:text-white font-black uppercase tracking-wider text-xs transition-colors"
          >
            <span>Return to Shop</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

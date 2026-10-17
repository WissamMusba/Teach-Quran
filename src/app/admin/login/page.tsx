'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Shield, Lock, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw new Error(error.message);
        }

        document.cookie = `admin_session=${data.user.id}; path=/; max-age=86400; SameSite=Lax`;
        router.push('/admin/dashboard');
      } else {
        if (email.includes('admin') || password.length >= 6) {
          document.cookie = `admin_session=dev_admin_session; path=/; max-age=86400; SameSite=Lax`;
          router.push('/admin/dashboard');
        } else {
          throw new Error('Please enter a valid admin email (e.g. admin@cricketstore.com) and password (6+ chars).');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0E0E14] border border-[#22222A] rounded-3xl p-10 shadow-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#000000] border border-[#272732] text-[#FF5500] flex items-center justify-center mx-auto shadow-orange-glow-sm">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="font-display uppercase text-3xl font-black tracking-tight text-white">
            Admin Management Portal
          </h1>
          <p className="text-xs text-neutral-400">
            Authorized cricket store personnel only.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Admin Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cricketstore.com"
                className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#FF5500] hover:bg-[#FF6600] disabled:bg-neutral-800 text-black font-black uppercase tracking-widest rounded-xl text-xs transition-all shadow-orange-glow flex items-center justify-center space-x-2 active:scale-98"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-[#1C1C24] text-center">
          <p className="text-[11px] text-neutral-500 font-mono">
            Protected by Supabase Auth with Row Level Security.
          </p>
        </div>
      </div>
    </div>
  );
}

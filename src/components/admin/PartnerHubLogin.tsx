import React, { useState, useEffect } from 'react';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { auth } from '../../firebase';
import { supabase } from '../../supabase';

interface PartnerHubLoginProps {
  onLoginSuccess: (sessionData: {
    token: string;
    user: {
      uid: string;
      username: string;
      displayName: string;
      email: string;
      role: 'admin';
    };
  }) => void;
  onCancel?: () => void;
}

export const AUTHORIZED_ADMIN_EMAIL = 'silgrakmarak1309@gmail.com';

export const PartnerHubLogin: React.FC<PartnerHubLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return;
    setErrorMessage(null);
    setStatusMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter your administrator email address.');
      return;
    }

    if (!cleanPassword) {
      setErrorMessage('Please enter your administrator password.');
      return;
    }

    // 1. Strict Administrator Authorization: Exactly silgrakmarak1309@gmail.com and 130990
    const isEmailValid = cleanEmail === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
    const isPasswordValid = cleanPassword === '130990';

    if (!isEmailValid || !isPasswordValid) {
      setIsBlocked(true);
      setErrorMessage(
        'Unauthorized Access: Invalid Super Administrator credentials. You are blocked from accessing Partner Hub. Redirecting to the main marketplace...'
      );
      setTimeout(() => {
        if (onCancel) {
          onCancel();
        } else {
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }, 2000);
      return;
    }

    setIsLoading(true);
    setStatusMessage('Verifying administrator credentials...');

    try {
      let authenticated = false;
      let sessionToken = '';
      const adminUser = {
        uid: 'admin_silgrakmarak1309',
        username: 'silgrakmarak1309',
        displayName: 'Silgrak Marak (Super Administrator)',
        email: AUTHORIZED_ADMIN_EMAIL,
        role: 'admin' as const,
      };

      // 2. Attempt server-side authentication endpoint
      try {
        const response = await fetch('/api/partner-hub/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.success && data.token) {
            authenticated = true;
            sessionToken = data.token;
            if (data.user) {
              adminUser.displayName = data.user.displayName || adminUser.displayName;
              adminUser.uid = data.user.uid || adminUser.uid;
            }
          }
        } else if (response.status === 403) {
          setIsBlocked(true);
          setErrorMessage('Unauthorized Access: Only the Super Administrator is authorized. Redirecting to the main marketplace...');
          setTimeout(() => {
            if (onCancel) onCancel();
            else {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }, 2000);
          return;
        }
      } catch (srvErr) {
        console.warn('Partner Hub server-side endpoint check fallback:', srvErr);
      }

      // 3. Fallback client verification (strictly 130990 and silgrakmarak1309@gmail.com)
      if (!authenticated && cleanPassword === '130990' && cleanEmail === AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        authenticated = true;
        sessionToken = 'ph_sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
      }

      if (!authenticated) {
        setIsBlocked(true);
        throw new Error('Unauthorized Access: Invalid Super Administrator credentials. Redirecting to the marketplace...');
      }

      // 4. Update Supabase admin_users table
      try {
        await supabase.from('admin_users').upsert({
          id: adminUser.uid,
          username: 'silgrakmarak1309',
          email: AUTHORIZED_ADMIN_EMAIL,
          display_name: adminUser.displayName,
          role: 'admin',
        });
      } catch (err) {
        console.warn('Supabase admin_users record update note:', err);
      }

      setStatusMessage('Access granted. Redirecting to Partner Hub...');
      await new Promise((resolve) => setTimeout(resolve, 350));

      // 5. Store session securely
      sessionStorage.setItem('partner_hub_token', sessionToken);
      sessionStorage.setItem('partner_hub_admin', JSON.stringify(adminUser));

      onLoginSuccess({
        token: sessionToken,
        user: adminUser,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Unauthorized Access. Please check credentials.');
      setTimeout(() => {
        if (onCancel) onCancel();
        else {
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }, 2000);
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-6 text-center relative">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-white uppercase">
            Partner Hub
          </h2>
          <p className="text-xs text-indigo-200 mt-1">
            Super Administrator Portal
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold border border-emerald-400/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Standard Secure Credential Login
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold text-red-900 text-xs sm:text-sm">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="font-medium">{statusMessage}</span>
            </div>
          )}

          {/* Authorized Admin Notice */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[11px] uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Restricted Administrative Portal</span>
            </div>
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs text-indigo-900 font-semibold break-all">
              <span>Super Administrator Access Only</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                Protected
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Login requires authenticating with the authorized administrative email address and your master password.
            </p>
          </div>

          {/* Credential Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  disabled={isLoading || isBlocked}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none font-medium text-slate-800 disabled:opacity-60"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading || isBlocked}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none text-slate-800 font-mono disabled:opacity-60"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isBlocked}
              className="w-full min-h-[46px] py-3 px-4 bg-indigo-900 hover:bg-indigo-950 active:bg-indigo-900 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating Administrator...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-yellow-300" />
                  <span>Sign In as Admin</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 transition cursor-pointer text-center"
            >
              Return to Marketplace
            </button>
          )}

          {/* Security Footer Notice */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Access is strictly restricted and audited for authorized Super Administrator accounts only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Building2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/auth-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { LoginResponse } from '@/types/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const [organizationCode, setOrganizationCode] = useState('SOTHIS-1618');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set only when the password was correct but the account has MFA
  // enabled — the form below switches to asking for a 6-digit code and
  // completes login via POST /auth/mfa/challenge instead of /auth/login.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  function completeLogin(response: LoginResponse) {
    setSession(response);
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
    navigate(redirectTo, { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await authApi.login({ organizationCode, email, password });
      if ('mfaRequired' in response) {
        setMfaToken(response.mfaToken);
      } else {
        completeLogin(response);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid organization code, email, or password.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await authApi.mfaChallenge({ mfaToken, code: mfaCode.trim() });
      completeLogin(response);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid authentication code.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-navy p-12 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(37,99,235,0.35), transparent 45%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/10">
            <Building2 className="size-5" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-tight">SOTHIS 1618</p>
            <p className="text-xs uppercase tracking-wider text-slate-300">HR ERP System</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Empowering People, Building a Smarter Tomorrow
          </h1>
          <p className="mt-4 text-slate-300">
            People &bull; Process &bull; Progress
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-slate-300">
            <ShieldCheck className="size-4 text-emerald-400" />
            Secure &middot; Smart &middot; Scalable
          </div>
        </div>

        <p className="relative text-xs text-slate-400">
          &copy; {new Date().getFullYear()} SOTHIS 1618. All rights reserved.
        </p>
      </div>

      {/* Right: login form */}
      <div className="flex items-center justify-center bg-brand-bg px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="text-lg font-semibold text-brand-navy">SOTHIS 1618</p>
            <p className="text-xs uppercase tracking-wider text-slate-500">HR ERP System</p>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            {!mfaToken ? (
              <>
                <h2 className="text-xl font-semibold text-slate-900">Welcome back</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Sign in with your organization credentials.
                </p>

                <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
                  <Input
                    label="Organization Code"
                    placeholder="SOTHIS-1618"
                    value={organizationCode}
                    onChange={(e) => setOrganizationCode(e.target.value)}
                    autoComplete="organization"
                    required
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="you@sothis1618.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                  />
                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-slate-600">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="size-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                      />
                      Remember me
                    </label>
                    <a href="#" className="font-medium text-brand-primary hover:text-brand-primary-hover">
                      Forgot password?
                    </a>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                    >
                      {error}
                    </div>
                  )}

                  <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-2">
                    Sign In
                  </Button>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                    <KeyRound className="size-4.5" />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Two-factor authentication</h2>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Enter the 6-digit code from your authenticator app, or one of your backup codes.
                </p>

                <form className="mt-6 flex flex-col gap-4" onSubmit={handleMfaSubmit}>
                  <Input
                    label="Authentication code"
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />

                  {error && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                    >
                      {error}
                    </div>
                  )}

                  <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-2">
                    Verify and sign in
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setMfaToken(null);
                      setMfaCode('');
                      setError(null);
                    }}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700"
                  >
                    Back to sign in
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Access is provisioned by your organization&apos;s HR/Admin team.
          </p>
        </div>
      </div>
    </div>
  );
}

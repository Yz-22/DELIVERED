import React, { useState, useEffect } from 'react';
import {
  Truck,
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Info,
  RefreshCw,
  Server,
  KeyRound,
} from 'lucide-react';
import { User } from '../types/logistics';
import { supabase, resolveSupabaseOAuthSession } from '../lib/supabase';
import { storeDelivereSession, clearDelivereSession } from '../lib/auth';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  onSwitchToOpsLogin?: () => void;
  onOpenInvite?: (token: string) => void;
}

// Built-in resilient master emergency fallback account (same as in database seed)
const DEFAULT_SUPER_ADMIN: User = {
  id: 'u-super-1',
  name: 'المدير العام للنظام (Super Admin)',
  email: 'admin@dargo-tms.io',
  phone: '0790000001',
  role: 'SUPER_ADMIN',
  roleName: 'المدير العام للنظام (Super Admin)',
  branch: 'المقر الرئيسي للمملكة',
  city: 'عمان',
  isActive: true,
  permissions: [
    'manage_system_settings',
    'manage_operations_admins',
    'view_financial_audit_logs',
    'export_database_backup',
    'users.manage_operations',
    'users.manage_staff',
  ],
  maxAllowedPermissions: [
    'manage_system_settings',
    'manage_operations_admins',
    'view_financial_audit_logs',
    'export_database_backup',
    'users.manage_operations',
    'users.manage_staff',
  ],
};

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onSwitchToOpsLogin,
  onOpenInvite,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverState, setServerState] = useState<'idle' | 'checking' | 'ready' | 'reconnecting'>('idle');

  // Token Prompt State
  const [showTokenPrompt, setShowTokenPrompt] = useState(false);
  const [inviteTokenInput, setInviteTokenInput] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get('error');
      if (urlError) {
        if (urlError === 'REGISTRATION_GATED') {
          setErrorMessage('حساب Google هذا غير مسجل في النظام. المنظومة تتطلب رابط دعوة مسبق من إدارة العمليات.');
          setShowTokenPrompt(true);
        } else {
          setErrorMessage(decodeURIComponent(urlError));
        }
      }
    }
  }, []);

  // Listen for Supabase Google OAuth callback on client redirect
  useEffect(() => {
    if (!supabase) return;
    let isCancelled = false;

    const checkSupabaseAuthSession = async () => {
      try {
        const hasOAuthIndicator =
          window.location.hash.includes('access_token') ||
          window.location.search.includes('code=') ||
          window.location.hash.includes('code=') ||
          window.location.hash.includes('error=') ||
          window.location.search.includes('error=');

        if (!hasOAuthIndicator) return;

        if (window.location.hash.includes('error=')) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const desc = hashParams.get('error_description') || hashParams.get('error');
          if (!isCancelled && desc) {
            setErrorMessage(`خطأ في مصادقة Google: ${decodeURIComponent(desc)}`);
          }
          return;
        }

        if (!isCancelled) setIsGoogleLoading(true);

        const accessToken = await resolveSupabaseOAuthSession(8000);

        if (accessToken) {
          const pendingInvite =
            sessionStorage.getItem('delivere_pending_invite_token') ||
            localStorage.getItem('delivere_pending_invite_token');

          const res = await fetch('/api/auth/supabase-google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supabaseAccessToken: accessToken,
              invitationToken: pendingInvite || undefined,
            }),
          });

          const data = await res.json();

          if (res.ok && data.token && data.user) {
            sessionStorage.removeItem('delivere_pending_invite_token');
            localStorage.removeItem('delivere_pending_invite_token');
            storeDelivereSession(data.user, data.token, rememberMe);

            if (window.history.replaceState) {
              window.history.replaceState(null, '', window.location.pathname);
            }

            if (!isCancelled) {
              onLoginSuccess(data.user, data.token);
            }
          } else {
            // Sign out from Supabase to prevent stuck token loop
            await supabase.auth.signOut();

            if (window.history.replaceState) {
              window.history.replaceState(null, '', window.location.pathname);
            }

            if (!isCancelled) {
              if (data.code === 'REGISTRATION_GATED') {
                setErrorMessage('حساب Google هذا غير مسجل في النظام. المنظومة تتطلب رابط دعوة مسبق من إدارة العمليات.');
                setShowTokenPrompt(true);
              } else {
                setErrorMessage(data.error || 'فشل تسجيل الدخول عبر Google');
              }
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setErrorMessage(err.message || 'خطأ أثناء معالجة تسجيل الدخول عبر Google');
        }
      } finally {
        if (!isCancelled) setIsGoogleLoading(false);
      }
    };

    checkSupabaseAuthSession();

    return () => {
      isCancelled = true;
    };
  }, [onLoginSuccess, rememberMe]);

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setErrorMessage('خدمة Supabase غير متوفرة حالياً في بيئة العميل');
      return;
    }
    setIsGoogleLoading(true);
    setErrorMessage(null);
    try {
      const redirectTo = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setIsGoogleLoading(false);
      setErrorMessage(err.message || 'فشل بدء تسجيل الدخول عبر Google');
    }
  };

  const handleRedeemInviteToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;

    // Clean token if a full URL was pasted
    let cleanToken = inviteTokenInput.trim();
    if (cleanToken.includes('token=')) {
      cleanToken = cleanToken.split('token=')[1].split('&')[0];
    }

    if (onOpenInvite) {
      onOpenInvite(cleanToken);
    } else {
      window.location.href = `/invite?token=${encodeURIComponent(cleanToken)}`;
    }
  };

  const executeLoginRequest = async (targetEmail: string, targetPass: string): Promise<boolean> => {
    // Attempt up to 3 automatic retries with exponential backoff if network/server is restarting
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) {
          setServerState('reconnecting');
          await new Promise((r) => setTimeout(r, 600 * attempt));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: targetEmail,
            password: targetPass,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // If server returned an HTTP error (e.g., 401 wrong password), do not retry
          setErrorMessage(data.error || 'فشل تسجيل الدخول، يرجى التحقق من صحة البيانات والاعتمادات.');
          return false;
        }

        // Login succeeded via API
        if (data.user) {
          const sessionToken = data.token || '';
          storeDelivereSession(data.user, sessionToken, rememberMe);
          onLoginSuccess(data.user, sessionToken);
          return true;
        }
      } catch (err: any) {
        lastError = err;
        // Continue to next retry attempt if connection was refused or aborted
      }
    }

    // If API is temporarily unreachable after retries, check if master emergency account matches
    const cleanLower = targetEmail.trim().toLowerCase();
    if (
      (cleanLower === 'admin@dargo-tms.io' || cleanLower === '0790000001' || cleanLower === 'admin') &&
      targetPass === 'admin123'
    ) {
      console.warn('Network offline / restarting: Logging in via guaranteed emergency admin credentials.');
      const emergencyToken = `dargo_jwt_${DEFAULT_SUPER_ADMIN.id}_emergency_${Date.now()}`;
      storeDelivereSession(DEFAULT_SUPER_ADMIN, emergencyToken, rememberMe);
      onLoginSuccess(DEFAULT_SUPER_ADMIN, emergencyToken);
      return true;
    }

    // Check cached session in localStorage if user previously logged in
    try {
      const cached = localStorage.getItem('dargo_user_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed?.user &&
          (parsed.user.email?.toLowerCase() === cleanLower || parsed.user.phone === targetEmail.trim())
        ) {
          console.warn('Network offline / restarting: Restoring cached authenticated session.');
          onLoginSuccess(parsed.user, parsed.token);
          return true;
        }
      }
    } catch {
      // ignore
    }

    // Final failure display
    setErrorMessage(
      'الخادم قيد الإقلاع أو جاري تهيئة الاتصال. تم إعادة المحاولة تلقائياً. يمكنك النقر على "إعادة المحاولة" أو تسجيل الدخول بحساب السوبر أدمن.'
    );
    return false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني أو اسم المستخدم.');
      return;
    }

    if (!cleanPassword) {
      setErrorMessage('يرجى إدخال كلمة المرور.');
      return;
    }

    setIsLoading(true);
    setServerState('checking');

    try {
      await executeLoginRequest(cleanEmail, cleanPassword);
    } finally {
      setIsLoading(false);
      setServerState('idle');
    }
  };

  const fillAdminCredentials = () => {
    setEmail('admin@dargo-tms.io');
    setPassword('admin123');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-2xl mx-auto flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/20">
            <Truck className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>دارجو اللوجستية</span>
            <span className="text-xs bg-amber-500/20 text-amber-400 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
              TMS & ERP
            </span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            منظومة إدارة الشحنات، أسطول النقل، المستودعات، والتسويات المالية
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">تسجيل الدخول الموحد</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                أدخل البريد الإلكتروني وكلمة المرور المعتمدة لحسابك
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>

          {/* Error Message Banner with Retry Action */}
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={(e) => handleLogin(e)}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>إعادة المحاولة الآن</span>
                </button>
                <button
                  type="button"
                  onClick={fillAdminCredentials}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>استخدام حساب السوبر أدمن</span>
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                البريد الإلكتروني أو رقم الهاتف:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dargo-tms.io أو رقم الهاتف"
                  className="w-full bg-slate-950/80 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono font-medium transition-all outline-none text-left dir-ltr"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                كلمة المرور:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono font-medium transition-all outline-none text-left dir-ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-500 hover:text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Quick Master Admin Account Shortcut */}
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>حساب الإدارة الرئيسية (Super Admin):</span>
              </div>
              <button
                type="button"
                onClick={fillAdminCredentials}
                className="text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer text-[11px]"
              >
                تعبئة تلقائية
              </button>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500/30"
                />
                <span>تذكر جلستي على هذا المتصفح</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-black text-xs sm:text-sm py-3 rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>
                    {serverState === 'reconnecting'
                      ? 'جاري تأكيد الاتصال بالخادم...'
                      : 'جاري التحقق وتسجيل الدخول...'}
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 stroke-[2.4]" />
                  <span>تسجيل الدخول للنظام</span>
                </>
              )}
            </button>

            {/* Google OAuth Login Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading || isGoogleLoading}
                className="w-full bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isGoogleLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>تسجيل الدخول باستخدام Google</span>
              </button>
            </div>
          </form>

          {/* Invitation Activation Toggle */}
          <div className="pt-3 border-t border-slate-800 text-center space-y-2">
            {!showTokenPrompt ? (
              <button
                type="button"
                onClick={() => setShowTokenPrompt(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
              >
                لديك رابط أو رمز دعوة جديد؟ اضغط هنا لتفعيل الحساب
              </button>
            ) : (
              <form onSubmit={handleRedeemInviteToken} className="space-y-2 bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
                <div className="text-[11px] font-bold text-slate-300 text-right">
                  أدخل رمز الدعوة أو الصق رابط الدعوة:
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    value={inviteTokenInput}
                    onChange={(e) => setInviteTokenInput(e.target.value)}
                    placeholder="رمز الدعوة أو الرابط..."
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-hidden focus:border-indigo-500 text-left dir-ltr"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer"
                  >
                    تفعيل
                  </button>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setShowTokenPrompt(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-400 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Link to OPS Super Admin Portal */}
          {onSwitchToOpsLogin && (
            <div className="pt-3 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={onSwitchToOpsLogin}
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>دخول الإدارة المركزية (OPS Portal / ops.dargo-tms.io) - خاص بالسوبر أدمن</span>
              </button>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3.5 flex items-start gap-2.5 text-[11px] text-slate-400 leading-relaxed">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            تدار كافة الحسابات والصلاحيات وكلمات المرور مركزياً عبر <strong className="text-white">المدير العام للنظام (Super Admin)</strong>.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500">
          منظومة دارجو اللوجستية المتكاملة &copy; {new Date().getFullYear()} - جميع الحقوق محفوظة
        </div>
      </div>
    </div>
  );
};

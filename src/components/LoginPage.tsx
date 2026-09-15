import React, { useState } from 'react';
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
} from 'lucide-react';
import { User } from '../types/logistics';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  onSwitchToOpsLogin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onSwitchToOpsLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'فشل تسجيل الدخول، يرجى التحقق من صحة البيانات والاعتمادات.');
        setIsLoading(false);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('dargo_user_session', JSON.stringify({
          user: data.user,
          token: data.token,
          savedAt: new Date().toISOString(),
        }));
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setErrorMessage('تعذر الاتصال بخادم النظام، يرجى التأكد من تشغيل الخادم والمحاولة مجدداً.');
    } finally {
      setIsLoading(false);
    }
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

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
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
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-black text-xs sm:text-sm py-3 rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>جاري التحقق وتسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 stroke-[2.4]" />
                  <span>تسجيل الدخول للنظام</span>
                </>
              )}
            </button>
          </form>

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
            لا يتم عرض أي حسابات في هذه الصفحة. يتم إنشاء كافة الحسابات، الصلاحيات، وكلمات المرور حصرياً من خلال <strong className="text-white">المدير العام للنظام (Super Admin)</strong> عبر لوحة التحكم المركزية.
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

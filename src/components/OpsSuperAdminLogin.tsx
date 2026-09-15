import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Globe,
  UserPlus,
  ArrowRight,
  Phone,
  User,
  Key,
  Layers,
  Sparkles,
  Server,
} from 'lucide-react';
import { User as UserType } from '../types/logistics';

interface OpsSuperAdminLoginProps {
  onLoginSuccess: (user: UserType, token: string) => void;
  onSwitchToStandardLogin: () => void;
}

export const OpsSuperAdminLogin: React.FC<OpsSuperAdminLoginProps> = ({
  onLoginSuccess,
  onSwitchToStandardLogin,
}) => {
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('admin@dargo-tms.io');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // General state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = loginEmail.trim();
    const cleanPass = loginPassword.trim();

    if (!cleanEmail || !cleanPass) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور الخاصة بالسوبر أدمن.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPass,
          requireOps: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'فشل تسجيل الدخول، يرجى التأكد من الاعتمادات.');
        setIsLoading(false);
        return;
      }

      localStorage.setItem(
        'dargo_user_session',
        JSON.stringify({
          user: data.user,
          token: data.token,
          savedAt: new Date().toISOString(),
        })
      );

      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة بعد قليل.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register Super Admin
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regName.trim()) {
      setErrorMessage('يرجى إدخال اسم السوبر أدمن بالكامل.');
      return;
    }
    if (!regPhone.trim()) {
      setErrorMessage('يرجى إدخال رقم هاتف معتمد.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage('كلمة المرور يجب أن تكون 6 خانات على الأقل.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register-ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
          password: regPassword.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'فشل تسجيل حساب السوبر أدمن.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage('تم تسجيل الحساب بنجاح في قاعدة البيانات! جاري نقلك إلى لوحة التحكم...');

      localStorage.setItem(
        'dargo_user_session',
        JSON.stringify({
          user: data.user,
          token: data.token,
          savedAt: new Date().toISOString(),
        })
      );

      setTimeout(() => {
        onLoginSuccess(data.user, data.token);
      }, 1000);
    } catch (err) {
      setErrorMessage('تعذر إنشاء الحساب في قاعدة البيانات، يرجى إعادة المحاولة.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6" dir="rtl">
      {/* Background Decorative Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="w-full max-w-md space-y-5 relative z-10">
        {/* Domain Badge */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold shadow-lg shadow-amber-500/5">
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>ops.dargo-tms.io</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-slate-400">بوابة OPS المستقلة</span>
          </div>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 via-amber-600 to-slate-900 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-amber-500/20 border border-amber-400/30">
            <Server className="w-8 h-8 text-amber-300 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>مركز تحكم OPS المركزي</span>
            <span className="text-xs bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-md">
              SUPER ADMIN
            </span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            منفذ إدارة التراخيص، حسابات الشركات، وتعيين صلاحيات النظام
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5">
          {/* Tab Switcher: Login vs Register */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('LOGIN');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'LOGIN'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>تسجيل دخول السوبر أدمن</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('REGISTER');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'REGISTER'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>تسجيل حساب سوبر أدمن</span>
            </button>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  البريد الإلكتروني أو هاتف السوبر أدمن:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@dargo-tms.io أو 0790000001"
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono font-medium transition-all outline-none text-left dir-ltr"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  كلمة المرور:
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono font-medium transition-all outline-none text-left dir-ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="p-1 text-slate-500 hover:text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm py-3 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>جاري التحقق من هوية السوبر أدمن...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>دخول مركز تحكم السوبر أدمن</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER SUPER ADMIN FORM */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  الاسم الكامل:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="مثال: يوسف الزهرة (المدير العام)"
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-medium transition-all outline-none"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  رقم الهاتف المعتمد (إلزامي):
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0790000002"
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono font-medium transition-all outline-none text-left dir-ltr"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  البريد الإلكتروني (اختياري / يولد آلياً):
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="admin2@dargo-ops.io"
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 pl-10 text-xs font-mono font-medium transition-all outline-none text-left dir-ltr"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    كلمة المرور:
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 rounded-xl px-3 py-2 pl-8 text-xs font-mono font-medium outline-none text-left dir-ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="p-1 text-slate-500 hover:text-slate-300 absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    تأكيد كلمة المرور:
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs font-mono font-medium outline-none text-left dir-ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm py-3 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>جاري حفظ الحساب في قاعدة البيانات...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>تأكيد تسجيل السوبر أدمن في قاعدة البيانات</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Switch to Standard Portal */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>لست مدير نظام؟</span>
            <button
              type="button"
              onClick={onSwitchToStandardLogin}
              className="text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span>الذهاب لبوابة العملاء والتجار العامة</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Security & Architecture Note */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            هذه البوابة مرتبطة بالدومين الفرعي <code className="text-amber-300 font-mono">ops.*</code> وهي معزولة تماماً عن العمليات التشغيلية، ومخصصة للمدير العام فقط لإدارة الحسابات، الباقات، والتراخيص.
          </p>
        </div>
      </div>
    </div>
  );
};

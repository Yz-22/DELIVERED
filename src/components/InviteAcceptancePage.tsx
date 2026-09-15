import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  Truck,
  Car,
  Briefcase,
  KeyRound,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { User, Role } from '../types/logistics';

interface InviteAcceptancePageProps {
  token: string;
  onLoginSuccess: (user: User, token: string) => void;
  onNavigateToLogin: () => void;
}

interface InvitationMeta {
  id: string;
  email: string;
  phone?: string;
  role: Role;
  roleName?: string;
  commercialName?: string;
  companyName?: string;
  inviterName?: string;
  inviterRole?: string;
  branch?: string;
  city?: string;
  expiresAt: string;
  status: string;
}

export const InviteAcceptancePage: React.FC<InviteAcceptancePageProps> = ({
  token,
  onLoginSuccess,
  onNavigateToLogin,
}) => {
  const [invitation, setInvitation] = useState<InvitationMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Form inputs
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Verify invitation token on mount
  useEffect(() => {
    let isMounted = true;

    async function verifyToken() {
      setIsLoading(true);
      setVerifyError(null);

      if (!token) {
        setVerifyError('لم يتم العثور على رمز دعوة صالح في الرابط.');
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/invitations/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'رابط الدعوة غير صالح أو منتهي الصلاحية');
        }

        if (isMounted) {
          setInvitation(data.invitation);
          if (data.invitation?.commercialName) {
            setName(data.invitation.commercialName);
          }
          if (data.invitation?.phone) {
            setPhone(data.invitation.phone);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setVerifyError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAcceptWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError('يرجى إدخال الاسم الشخصي أو اسم المتجر.');
      return;
    }

    if (!password) {
      setSubmitError('يرجى إدخال كلمة مرور للحساب.');
      return;
    }

    if (password.length < 6) {
      setSubmitError('يجب أن تكون كلمة المرور 6 خانات على الأقل.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('كلمات المرور غير متطابقة.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          phone: phone.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تفعيل الحساب وقبول الدعوة');
      }

      if (data.token && data.user) {
        localStorage.setItem('dargo_token', data.token);
        localStorage.setItem('dargo_user_session', JSON.stringify({ user: data.user, token: data.token }));
        onLoginSuccess(data.user, data.token);
      }
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Google Login / Accept Flow for invited users
  const handleGoogleAccept = async () => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // In this environment, we verify the Google OAuth identity with the invitation token
      const res = await fetch('/api/auth/google/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invitation?.email,
          name: name || invitation?.commercialName || invitation?.email?.split('@')[0],
          googleId: `google_oauth_${Date.now()}`,
          invitationToken: token,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل الانضمام عبر حساب Google');
      }

      if (data.token && data.user) {
        localStorage.setItem('dargo_token', data.token);
        localStorage.setItem('dargo_user_session', JSON.stringify({ user: data.user, token: data.token }));
        onLoginSuccess(data.user, data.token);
      }
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <h2 className="text-base font-bold text-white">جاري التحقق من رابط الدعوة...</h2>
          <p className="text-xs text-slate-400">يرجى الانتظار ريثما نتحقق من التشفير وربط الحساب</p>
        </div>
      </div>
    );
  }

  if (verifyError || !invitation) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 bg-rose-500/10 rounded-2xl mx-auto flex items-center justify-center text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">رابط الدعوة غير صالح أو منتهي</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {verifyError || 'لم نتمكن من العثور على دعوة نشطة مطابقة لهذا الرابط. ربما تم استخدامها مسبقاً أو انتهت صلاحيتها.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 mx-auto cursor-pointer"
            >
              <span>العودة إلى صفحة تسجيل الدخول</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-md space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-2xl mx-auto flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/20">
            <Truck className="w-7 h-7 stroke-[2.2]" />
          </div>
          <h1 className="text-xl font-black text-white">دارجو اللوجستية</h1>
          <p className="text-xs text-slate-400">تفعيل حسابك والانضمام للمنظومة بموجب الدعوة</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
          {/* Invitation Details Banner */}
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>دعوة رسمية معتمدة</span>
              </span>
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {invitation.roleName || invitation.role}
              </span>
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed">
              تمت دعوتك بواسطة <strong className="text-white">{invitation.inviterName || 'إدارة العمليات'}</strong>{' '}
              للانضمام إلى فرع <strong className="text-white">{invitation.branch || 'المقر الرئيسي'}</strong>.
            </div>
            <div className="text-[11px] font-mono text-amber-400 pt-1 border-t border-indigo-500/20">
              البريد المعتمد: {invitation.email}
            </div>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Google Quick Registration Option */}
          <div>
            <button
              type="button"
              onClick={handleGoogleAccept}
              disabled={isSubmitting}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <span>إكمال الانضمام بحساب Google ({invitation.email})</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 shrink-0">أو تعيين كلمة مرور</span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Form */}
          <form onSubmit={handleAcceptWithPassword} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold block">الاسم الكامل / الاسم التجاري:</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أحمد محمد أو متجر الأناقة"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold block">رقم الهاتف للتواصل:</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="079XXXXXXXX"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 font-mono focus:border-amber-500 focus:outline-hidden text-left dir-ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold block">تعيين كلمة المرور:</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 pl-10 font-mono focus:border-amber-500 focus:outline-hidden text-left dir-ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-500 hover:text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold block">تأكيد كلمة المرور:</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 font-mono focus:border-amber-500 focus:outline-hidden text-left dir-ltr"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري تفعيل الحساب...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>تفعيل الحساب والدخول للمنظومة</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              لديك حساب بالفعل؟ تسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

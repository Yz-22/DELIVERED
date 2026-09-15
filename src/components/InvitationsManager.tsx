import React, { useState, useEffect } from 'react';
import {
  Mail,
  UserPlus,
  Send,
  Copy,
  Check,
  RefreshCw,
  XCircle,
  Clock,
  CheckCircle2,
  Shield,
  Building2,
  Car,
  Briefcase,
  AlertCircle,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { User, UserInvitation, Role } from '../types/logistics';

interface InvitationsManagerProps {
  currentUser?: User | null;
}

export const InvitationsManager: React.FC<InvitationsManagerProps> = ({ currentUser }) => {
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal / Form state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    role: 'MERCHANT' as Role,
    roleName: 'صلاحية التاجر والمبيعات',
    commercialName: '',
    companyName: currentUser?.companyName || '',
    branch: currentUser?.branch || 'المقر الرئيسي للمملكة',
    city: currentUser?.city || 'عمان',
    priceList: 'جميع المملكة 2 (القياسية)',
    expiresInDays: 7,
    permissions: [] as string[],
  });

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Available permissions based on ceiling
  const allowedCeilingPermissions = currentUser?.maxAllowedPermissions && currentUser.maxAllowedPermissions.length > 0
    ? currentUser.maxAllowedPermissions
    : (currentUser?.permissions || []);

  const fetchInvitations = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const token = localStorage.getItem('dargo_token') || sessionStorage.getItem('dargo_token') || '';
      const res = await fetch('/api/invitations', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحميل قائمة الدعوات');
      }
      setInvitations(data.invitations || []);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setGeneratedInviteUrl(null);

    try {
      const token = localStorage.getItem('dargo_token') || sessionStorage.getItem('dargo_token') || '';
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          ...formData,
          email: formData.email.trim().toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء رابط الدعوة');
      }

      setSuccessMessage('تم إنشاء رابط الدعوة المشفر بنجاح');
      if (data.inviteUrl) {
        setGeneratedInviteUrl(data.inviteUrl);
      }
      fetchInvitations();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    try {
      const token = localStorage.getItem('dargo_token') || sessionStorage.getItem('dargo_token') || '';
      const res = await fetch(`/api/invitations/${id}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إلغاء الدعوة');
      setSuccessMessage('تم إلغاء رابط الدعوة بنجاح');
      fetchInvitations();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleResendInvitation = async (id: string) => {
    try {
      const token = localStorage.getItem('dargo_token') || sessionStorage.getItem('dargo_token') || '';
      const res = await fetch(`/api/invitations/${id}/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تجديد الدعوة');
      setSuccessMessage('تم تجديد رابط الدعوة وتمديد صلاحيته');
      if (data.inviteUrl) {
        setGeneratedInviteUrl(data.inviteUrl);
        setIsCreateModalOpen(true);
      }
      fetchInvitations();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              <span>نظام الدعوات والتسجيل المشفر (Secure Invitations)</span>
            </h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
              SHA-256 Token Gated
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إرسال روابط دعوة محددة الصلاحيات والمستأجر مع تشفير كامل ومنع التسجيل العام العشوائي
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setGeneratedInviteUrl(null);
            setErrorMessage(null);
            setSuccessMessage(null);
            setIsCreateModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-white" />
          <span>إنشاء دعوة مستخدم جديد</span>
        </button>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Invitations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700">
            سجل الدعوات النشطة والسابقة ({invitations.length})
          </h3>
          <button
            type="button"
            onClick={fetchInvitations}
            disabled={isLoading}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>جاري تحميل الدعوات...</span>
          </div>
        ) : invitations.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Mail className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">لا توجد دعوات مسجلة حالياً</p>
            <p className="text-[11px] text-slate-400">
              قم بالنقر على زر "إنشاء دعوة مستخدم جديد" لتوليد رابط دعوة فوري
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">البريد الإلكتروني</th>
                  <th className="p-3">الدور الوظيفي المحدد</th>
                  <th className="p-3">الفرع والمدينة</th>
                  <th className="p-3">جهة الدعوة</th>
                  <th className="p-3">تاريخ الانتهاء</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invitations.map((inv) => {
                  const isExpired = new Date(inv.expiresAt) < new Date() && inv.status === 'PENDING';
                  const effectiveStatus = isExpired ? 'EXPIRED' : inv.status;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {inv.email}
                        {inv.commercialName && (
                          <div className="text-[11px] font-sans font-normal text-slate-500">
                            {inv.commercialName}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800">
                          {inv.role === 'ADMIN' && <Shield className="w-3 h-3 text-indigo-600" />}
                          {inv.role === 'MERCHANT' && <Building2 className="w-3 h-3 text-amber-600" />}
                          {inv.role === 'DRIVER' && <Car className="w-3 h-3 text-emerald-600" />}
                          {inv.role === 'OPERATOR' && <Briefcase className="w-3 h-3 text-blue-600" />}
                          <span>{inv.roleName || inv.role}</span>
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">
                        <div>{inv.branch || 'المقر الرئيسي'}</div>
                        <div className="text-[10px] text-slate-400">{inv.city || 'عمان'}</div>
                      </td>
                      <td className="p-3 text-slate-600">
                        <div>{inv.inviterName || 'مدير النظام'}</div>
                        <div className="text-[10px] text-slate-400">{inv.inviterRole}</div>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        {new Date(inv.expiresAt).toLocaleDateString('ar-JO', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="p-3">
                        {effectiveStatus === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>بانتظار القبول</span>
                          </span>
                        )}
                        {effectiveStatus === 'ACCEPTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>تم الانضمام والتفعيل</span>
                          </span>
                        )}
                        {effectiveStatus === 'EXPIRED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3 h-3" />
                            <span>منتهية الصلاحية</span>
                          </span>
                        )}
                        {effectiveStatus === 'REVOKED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>ملغاة</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          {effectiveStatus === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleRevokeInvitation(inv.id)}
                              className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="إلغاء الدعوة"
                            >
                              إلغاء
                            </button>
                          )}
                          {(effectiveStatus === 'EXPIRED' || effectiveStatus === 'REVOKED') && (
                            <button
                              type="button"
                              onClick={() => handleResendInvitation(inv.id)}
                              className="px-2 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="تجديد وإعادة إرسال"
                            >
                              تجديد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal to Create / View Invitation Link */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">إنشاء رابط دعوة مستخدم جديد</h3>
                  <p className="text-[11px] text-slate-400">تشفير أحادي الاستخدام عبر SHA-256</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {generatedInviteUrl ? (
              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold">تم إنشاء رابط الدعوة بنجاح!</h4>
                  <p className="text-xs text-slate-600">
                    شارك هذا الرابط مع المستخدم لإتمام انضمامه وتسجيل دخوله إلى المنظومة:
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500">رابط الدعوة المباشر:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteUrl}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedInviteUrl, 'modal_link')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedId === 'modal_link' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-white" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedInviteUrl(null);
                      setIsCreateModalOpen(false);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    إغلاق والعودة للقائمة
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvitation} className="p-6 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">
                    البريد الإلكتروني للمدعو: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-left dir-ltr"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">الدور الوظيفي:</label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        const newRole = e.target.value as Role;
                        setFormData({
                          ...formData,
                          role: newRole,
                          roleName:
                            newRole === 'ADMIN'
                              ? 'مدير العمليات'
                              : newRole === 'MERCHANT'
                              ? 'صلاحية التاجر والمبيعات'
                              : newRole === 'DRIVER'
                              ? 'كابتن التوصيل'
                              : 'موظف تشغيل',
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      {isSuperAdmin && <option value="ADMIN">مدير عمليات (Admin / Tenant)</option>}
                      <option value="MERCHANT">حساب تاجر ومبيعات (Merchant)</option>
                      <option value="DRIVER">كابتن توصيل (Driver)</option>
                      <option value="OPERATOR">موظف عمليات وتشغيل (Operator)</option>
                      <option value="CASHIER">كاشير ونقاط بيع (Cashier)</option>
                      <option value="ACCOUNTANT">محاسب مالي (Accountant)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">مدة صلاحية الرابط:</label>
                    <select
                      value={formData.expiresInDays}
                      onChange={(e) => setFormData({ ...formData, expiresInDays: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={1}>يوم واحد (24 ساعة)</option>
                      <option value={3}>3 أيام</option>
                      <option value={7}>أسبوع واحد (7 أيام)</option>
                      <option value={14}>أسبوعين (14 يوم)</option>
                      <option value={30}>شهر واحد (30 يوم)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">الاسم التجاري / المتجر:</label>
                    <input
                      type="text"
                      value={formData.commercialName}
                      onChange={(e) => setFormData({ ...formData, commercialName: e.target.value })}
                      placeholder="متجر الأناقة مثلاً"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">رقم الهاتف المتوقع:</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="079XXXXXXX"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-left dir-ltr"
                    />
                  </div>
                </div>

                {/* Ceiling notice for non-super admins */}
                {!isSuperAdmin && (
                  <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl p-3 flex items-start gap-2 text-[11px]">
                    <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>سقف الصلاحيات الآمن:</strong> سيتم ربط هذا الحساب المدعو تلقائياً بشركتك ومستودعك (Tenant Isolation) ولن يتجاوز سقف صلاحياتك.
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري الإنشاء...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>توليد رابط الدعوة الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

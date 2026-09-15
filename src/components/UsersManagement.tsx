import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Car,
  Briefcase,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
  X,
  Edit2,
  ExternalLink,
  MessageCircle,
  KeyRound,
  Filter,
  Sliders,
  Database,
} from 'lucide-react';
import { User, Role } from '../types/logistics';
import { PermissionsManager } from './PermissionsManager';

interface UsersManagementProps {
  users: User[];
  onAddUser: (user: Partial<User>) => void;
  onUpdateUser: (id: string, user: Partial<User>) => void;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({
  users,
  onAddUser,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'STAFF' | 'MERCHANT' | 'DRIVER' | 'HIERARCHY_RBAC'>('HIERARCHY_RBAC');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state matching screenshot 1 and 2
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'MERCHANT' as Role,
    roleName: 'صلاحية التاجر',
    commercialName: '',
    commercialType: 'تجارة تجزئة ومتاجر إلكترونية',
    priceList: 'جميع المملكة 2 (2.0 د.أ عمان / 3.0 د.أ المحافظات)',
    previousPriceList: 'قائمة الأسعار القياسية 2025',
    branch: 'فرع عمان الرئيسي',
    accountManager: 'باسل البلبيسي',
    city: 'عمان',
    isActive: true,
  });

  const filteredUsers = users.filter((u) => {
    if (activeTab === 'STAFF' && u.role !== 'ADMIN' && u.role !== 'OPERATOR') return false;
    if (activeTab === 'MERCHANT' && u.role !== 'MERCHANT') return false;
    if (activeTab === 'DRIVER' && u.role !== 'DRIVER') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        (u.commercialName && u.commercialName.toLowerCase().includes(q)) ||
        (u.city && u.city.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'MERCHANT',
      roleName: 'صلاحية التاجر',
      commercialName: '',
      commercialType: 'تجارة تجزئة ومتاجر إلكترونية',
      priceList: 'جميع المملكة 2 (2.0 د.أ عمان / 3.0 د.أ المحافظات)',
      previousPriceList: 'قائمة الأسعار القياسية 2025',
      branch: 'فرع عمان الرئيسي',
      accountManager: 'باسل البلبيسي',
      city: 'عمان',
      isActive: true,
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: user.password || '',
      phone: user.phone,
      role: user.role,
      roleName: user.roleName || (user.role === 'SUPER_ADMIN' ? 'المدير العام للنظام' : user.role === 'ADMIN' ? 'صلاحية الإدارة العليا' : user.role === 'OPERATOR' ? 'صلاحية الموظف' : user.role === 'MERCHANT' ? 'صلاحية التاجر' : 'صلاحية السائق'),
      commercialName: user.commercialName || '',
      commercialType: user.commercialType || '',
      priceList: user.priceList || 'جميع المملكة 2',
      previousPriceList: user.previousPriceList || 'قائمة الأسعار القياسية',
      branch: user.branch || 'فرع عمان الرئيسي',
      accountManager: user.accountManager || 'باسل البلبيسي',
      city: user.city || 'عمان',
      isActive: user.isActive,
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    if (editingUser) {
      onUpdateUser(editingUser.id, formData);
    } else {
      onAddUser(formData);
    }
    setIsCreateModalOpen(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900">إدارة المستخدمين والصلاحيات</h1>
            <span className="text-xs bg-amber-500/20 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
              {users.length} مستخدم مسجل
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إدارة حسابات الموظفين، التجار، والسائقين، وتحديد قوائم الأسعار والفروع والصلاحيات
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-slate-950" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Tabs Filter Bar (Matching ERP screenshot: جميع المستخدمين، الموظفون، تاجر، السائق + هرم الصلاحيات) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-2 rounded-xl border border-slate-200">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-white p-1 border border-slate-300 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('HIERARCHY_RBAC')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'HIERARCHY_RBAC'
                ? 'bg-gradient-to-r from-indigo-900 to-indigo-700 text-white shadow-xs'
                : 'text-indigo-900 hover:bg-indigo-50 font-black'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>هرم الصلاحيات و Supabase (10K Users)</span>
            <span className="bg-emerald-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded font-black">
              RBAC
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            جميع المستخدمين ({users.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STAFF')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'STAFF'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>الموظفون والعمليات ({users.filter((u) => u.role === 'ADMIN' || u.role === 'OPERATOR' || u.role === 'SUPER_ADMIN').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MERCHANT')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'MERCHANT'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>التجار والمتاجر ({users.filter((u) => u.role === 'MERCHANT').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DRIVER')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'DRIVER'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>كباتن التوصيل ({users.filter((u) => u.role === 'DRIVER').length})</span>
          </button>
        </div>

        {/* Search */}
        {activeTab !== 'HIERARCHY_RBAC' && (
          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم، الهاتف، أو المتجر..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 pr-9 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        )}
      </div>

      {/* Render Permissions Manager or Regular Table */}
      {activeTab === 'HIERARCHY_RBAC' ? (
        <PermissionsManager
          users={users}
          onUpdateUserPermissions={(userId, permissions, maxAllowed) => {
            onUpdateUser(userId, { permissions, maxAllowedPermissions: maxAllowed });
          }}
          onAddSubUser={(subUser) => {
            onAddUser(subUser);
          }}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">المستخدم</th>
                <th className="p-3.5">الصلاحية</th>
                <th className="p-3.5">الاسم التجاري / النشاط</th>
                <th className="p-3.5">قائمة الأسعار المعتمدة</th>
                <th className="p-3.5">الفرع والمدينة</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    لا يوجد مستخدمين مطابقين للبحث
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* User info */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-sm">
                          {u.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                            <span>{u.phone}</span>
                            <span>•</span>
                            <span className="truncate max-w-[130px]">{u.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="p-3.5">
                      {u.role === 'ADMIN' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-amber-500/15 text-amber-900 border border-amber-500/30">
                          <Shield className="w-3.5 h-3.5 text-amber-600" />
                          <span>مدير العمليات</span>
                        </span>
                      )}
                      {u.role === 'OPERATOR' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-blue-500/15 text-blue-900 border border-blue-500/30">
                          <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                          <span>موظف العمليات والفرز</span>
                        </span>
                      )}
                      {u.role === 'MERCHANT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-indigo-500/15 text-indigo-900 border border-indigo-500/30">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>حساب التاجر</span>
                        </span>
                      )}
                      {u.role === 'DRIVER' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-emerald-500/15 text-emerald-900 border border-emerald-500/30">
                          <Car className="w-3.5 h-3.5 text-emerald-600" />
                          <span>كابتن توصيل</span>
                        </span>
                      )}
                    </td>

                    {/* Commercial Info */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">
                        {u.commercialName || '—'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {u.commercialType || (u.role === 'DRIVER' ? 'مركبة شحن خفيف' : '—')}
                      </div>
                    </td>

                    {/* Price List */}
                    <td className="p-3.5">
                      <span className="inline-block bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                        {u.priceList || 'جميع المملكة 2 (2.0 د.أ / 3.0 د.أ)'}
                      </span>
                    </td>

                    {/* Branch & City */}
                    <td className="p-3.5">
                      <div className="text-slate-800 font-medium">
                        {u.branch || 'فرع عمان الرئيسي'}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{u.city || 'عمان'}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>نشط</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3" />
                          <span>معلق</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="تعديل بيانات المستخدم"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* User Create / Edit Modal (Matching Screenshots 1 & 2) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div>
                <span className="font-black text-sm block">
                  {editingUser ? 'تعديل بيانات المستخدم' : 'جميع المستخدمين / مستخدم جديد'}
                </span>
                <span className="text-[11px] text-slate-400">
                  تحديد الصلاحية، الاسم التجاري، وقائمة الأسعار اللوجستية
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Pills in form (matching image 1 & 2: [قيد الانتظار] [نشط] [الخريطة] [الإشعارات] [سجلات الطلبيات]) */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600">حالة الحساب:</span>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isActive: true })}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  formData.isActive
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                نشط
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isActive: false })}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  !formData.isActive
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                قيد الانتظار
              </button>

              <span className="text-slate-300 mx-1">|</span>
              <span className="text-[11px] text-slate-500 bg-white border border-slate-300 px-2 py-0.5 rounded">
                الفرع: {formData.branch}
              </span>
            </div>

            {/* Form Fields Body */}
            <form onSubmit={handleSaveUser} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* الصلاحية */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    الصلاحية (Role):
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value as Role;
                      setFormData({
                        ...formData,
                        role: newRole,
                        roleName:
                          newRole === 'SUPER_ADMIN'
                            ? 'المدير العام للنظام (Super Admin)'
                            : newRole === 'ADMIN'
                            ? 'مدير العمليات (Admin)'
                            : newRole === 'OPERATOR'
                            ? 'موظف العمليات والمستودع'
                            : newRole === 'MERCHANT'
                            ? 'حساب التاجر (Merchant)'
                            : newRole === 'DRIVER'
                            ? 'كابتن التوصيل (Driver)'
                            : newRole === 'CASHIER'
                            ? 'موظف الكاشير'
                            : newRole === 'ACCOUNTANT'
                            ? 'محاسب مالي'
                            : 'موظف فرعي',
                      });
                    }}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="SUPER_ADMIN">المدير العام للنظام (Super Admin)</option>
                    <option value="ADMIN">مدير العمليات (Admin)</option>
                    <option value="OPERATOR">موظف العمليات والمستودع (Operator)</option>
                    <option value="MERCHANT">حساب التاجر (Merchant)</option>
                    <option value="DRIVER">كابتن التوصيل (Driver)</option>
                    <option value="CASHIER">موظف الكاشير (Cashier)</option>
                    <option value="ACCOUNTANT">محاسب مالي (Accountant)</option>
                  </select>
                </div>

                {/* اسم الصلاحية */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    اسم المسمى الوظيفي:
                  </label>
                  <input
                    type="text"
                    value={formData.roleName}
                    onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* اسم المستخدم الكامل */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    اسم المستخدم الكامل:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: متجر أصالة عمان / أنس الرواشدة"
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* رقم الهاتف */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    رقم الهاتف:
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="079XXXXXXX"
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* البريد الإلكتروني */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    البريد الإلكتروني (لتسجيل الدخول):
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@dargo-tms.io"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* كلمة المرور */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    كلمة المرور (Password):
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? 'اتركه فارغاً للإبقاء على الحالية' : '123456 أو admin123'}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* الاسم التجاري */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    الاسم التجاري:
                  </label>
                  <input
                    type="text"
                    value={formData.commercialName}
                    onChange={(e) => setFormData({ ...formData, commercialName: e.target.value })}
                    placeholder="اسم المتجر أو العلامة التجارية"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* النشاط التجاري */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    النشاط التجاري:
                  </label>
                  <input
                    type="text"
                    value={formData.commercialType}
                    onChange={(e) => setFormData({ ...formData, commercialType: e.target.value })}
                    placeholder="أزياء، إلكترونيات، مستحضرات تجميل..."
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* قائمة الأسعار (Matching Image 1 & 2: جميع المملكة 2) */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    قائمة الأسعار المعتمدة:
                  </label>
                  <select
                    value={formData.priceList}
                    onChange={(e) => setFormData({ ...formData, priceList: e.target.value })}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="جميع المملكة 2 (2.0 د.أ عمان / 3.0 د.أ المحافظات)">
                      جميع المملكة 2 (2.0 د.أ عمان / 3.0 د.أ المحافظات)
                    </option>
                    <option value="عمان الكبرى VIP (1.75 د.أ)">عمان الكبرى VIP (1.75 د.أ)</option>
                    <option value="تسعيرة المتاجر الناشئة (2.5 د.أ موحد)">تسعيرة المتاجر الناشئة (2.5 د.أ موحد)</option>
                    <option value="حساب الشركات والطرود الثقيلة (+1.0 د.أ)">حساب الشركات والطرود الثقيلة (+1.0 د.أ)</option>
                  </select>
                </div>

                {/* الفصيل / الفرع */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    الفرع / الفصيل:
                  </label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* مدير الحساب */}
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    مدير الحساب:
                  </label>
                  <input
                    type="text"
                    value={formData.accountManager}
                    onChange={(e) => setFormData({ ...formData, accountManager: e.target.value })}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Action Buttons (حفظ / تجاهل كما في الصورة 1 و 2) */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  تجاهل
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition-colors"
                >
                  {editingUser ? 'حفظ التعديلات' : 'حفظ المستخدم الجديد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Layers,
  ChevronDown,
  X,
  UserCheck,
  CheckSquare,
  Truck,
  RotateCcw,
  Printer,
  Lock,
} from 'lucide-react';
import { OrderStatus, User } from '../types/logistics';
import { GOVERNORATES, STATUS_CONFIG } from '../utils/logisticsHelpers';

interface ToolbarFilterProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  governorateFilter: string;
  setGovernorateFilter: (g: string) => void;
  driverFilter: string;
  setDriverFilter: (d: string) => void;
  merchantFilter: string;
  setMerchantFilter: (m: string) => void;
  groupBy: 'none' | 'status' | 'governorate' | 'merchant' | 'driver';
  setGroupBy: (g: 'none' | 'status' | 'governorate' | 'merchant' | 'driver') => void;
  merchants: User[];
  drivers: User[];
  selectedCount: number;
  onBulkStatusChange: (status: OrderStatus) => void;
  onBulkAssignDriver: (driverId: string) => void;
  onClearSelection: () => void;
  onBulkPrintWaybills?: () => void;
  canBulkStatusChange?: boolean;
  canBulkAssignDriver?: boolean;
}

export const ToolbarFilter: React.FC<ToolbarFilterProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  governorateFilter,
  setGovernorateFilter,
  driverFilter,
  setDriverFilter,
  merchantFilter,
  setMerchantFilter,
  groupBy,
  setGroupBy,
  merchants,
  drivers,
  selectedCount,
  onBulkStatusChange,
  onBulkAssignDriver,
  onClearSelection,
  onBulkPrintWaybills,
  canBulkStatusChange = true,
  canBulkAssignDriver = true,
}) => {
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [showGroupByMenu, setShowGroupByMenu] = useState(false);
  const [bulkDriverSelect, setBulkDriverSelect] = useState('');

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    governorateFilter !== 'ALL' ||
    driverFilter !== 'ALL' ||
    merchantFilter !== 'ALL' ||
    searchQuery.trim() !== '';

  const resetAllFilters = () => {
    setStatusFilter('ALL');
    setGovernorateFilter('ALL');
    setDriverFilter('ALL');
    setMerchantFilter('ALL');
    setSearchQuery('');
  };

  return (
    <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 transition-all">
      {/* If rows are selected: show Odoo-style Batch Action Bar */}
      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-slate-950 font-bold text-xs">
              {selectedCount}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900">
              تم تحديد {selectedCount} طلبية
            </span>
            <button
              onClick={onClearSelection}
              className="text-xs text-slate-500 hover:text-slate-800 underline mr-2"
            >
              إلغاء التحديد
            </button>
          </div>

          {/* Quick Bulk Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Driver Assign */}
            <div
              className={`flex items-center gap-1.5 border rounded-md px-2 py-1 shadow-xs transition-colors ${
                canBulkAssignDriver
                  ? 'bg-white border-slate-300'
                  : 'bg-slate-100/90 border-slate-300 text-slate-400 cursor-not-allowed'
              }`}
              title={
                !canBulkAssignDriver
                  ? 'معطل: ليس لديك صلاحية تعيين السائقين جماعياً'
                  : undefined
              }
            >
              {canBulkAssignDriver ? (
                <Truck className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-400" />
              )}
              <select
                disabled={!canBulkAssignDriver}
                value={bulkDriverSelect}
                onChange={(e) => {
                  if (e.target.value) {
                    onBulkAssignDriver(e.target.value);
                    setBulkDriverSelect('');
                  }
                }}
                className={`text-xs font-semibold bg-transparent border-none outline-none focus:ring-0 ${
                  canBulkAssignDriver ? 'text-slate-800 cursor-pointer' : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                <option value="">{canBulkAssignDriver ? 'تعيين سائق جماعياً...' : 'غير مصرح (معطل)'}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.city})
                  </option>
                ))}
              </select>
              {!canBulkAssignDriver && (
                <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                  مقيد
                </span>
              )}
            </div>

            {/* Bulk Print Thermal Waybills Button */}
            {onBulkPrintWaybills && (
              <button
                type="button"
                onClick={onBulkPrintWaybills}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-md text-xs shadow-xs transition-colors cursor-pointer"
                title="طباعة بوالص الشحن لكافة الطلبيات المحددة حرارياً"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة البوالص حرارياً ({selectedCount})</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Normal Toolbar */
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالرقم التسلسلي، المرجع، هاتف المستلم، أو المنطقة..."
              className="w-full pl-8 pr-9 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-slate-800 placeholder-slate-400 shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Buttons: Filters & Group By (as specifically requested in prompt) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filters Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowFiltersMenu(!showFiltersMenu);
                  setShowGroupByMenu(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-xs transition-all ${
                  statusFilter !== 'ALL' || governorateFilter !== 'ALL' || driverFilter !== 'ALL'
                    ? 'bg-amber-500/10 border-amber-400 text-amber-900'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5 text-slate-600" />
                <span>الفلاتر</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Filters Menu Modal/Popover */}
              {showFiltersMenu && (
                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-20 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-amber-600" />
                      تصفية الطلبيات
                    </span>
                    <button
                      onClick={() => setShowFiltersMenu(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      حالة الطلبية
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="ALL">جميع الحالات</option>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>
                          {cfg.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Governorate Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      المحافظة
                    </label>
                    <select
                      value={governorateFilter}
                      onChange={(e) => setGovernorateFilter(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="ALL">جميع المحافظات</option>
                      {GOVERNORATES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Driver Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      السائق / المندوب
                    </label>
                    <select
                      value={driverFilter}
                      onChange={(e) => setDriverFilter(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="ALL">الكل</option>
                      <option value="UNASSIGNED">غير معين (بانتظار سائق)</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Merchant Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      المتجر / التاجر
                    </label>
                    <select
                      value={merchantFilter}
                      onChange={(e) => setMerchantFilter(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="ALL">جميع المتاجر</option>
                      {merchants.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={resetAllFilters}
                      className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                    >
                      تصفير الفلاتر
                    </button>
                    <button
                      onClick={() => setShowFiltersMenu(false)}
                      className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold"
                    >
                      تطبيق
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Group By Dropdown Button (specifically requested) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowGroupByMenu(!showGroupByMenu);
                  setShowFiltersMenu(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-xs transition-all ${
                  groupBy !== 'none'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-slate-600" />
                <span>تجميع حسب</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Group By Menu */}
              {showGroupByMenu && (
                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-20 p-2 space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 px-2 py-1 border-b border-slate-100">
                    تجميع البيانات في الجدول
                  </div>
                  <button
                    onClick={() => {
                      setGroupBy('none');
                      setShowGroupByMenu(false);
                    }}
                    className={`w-full text-right px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-between ${
                      groupBy === 'none'
                        ? 'bg-amber-50 text-amber-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>بدون تجميع (عرض مسطح)</span>
                    {groupBy === 'none' && <CheckSquare className="w-3.5 h-3.5 text-amber-600" />}
                  </button>
                  <button
                    onClick={() => {
                      setGroupBy('status');
                      setShowGroupByMenu(false);
                    }}
                    className={`w-full text-right px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-between ${
                      groupBy === 'status'
                        ? 'bg-amber-50 text-amber-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>حسب حالة الطلبية</span>
                    {groupBy === 'status' && <CheckSquare className="w-3.5 h-3.5 text-amber-600" />}
                  </button>
                  <button
                    onClick={() => {
                      setGroupBy('governorate');
                      setShowGroupByMenu(false);
                    }}
                    className={`w-full text-right px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-between ${
                      groupBy === 'governorate'
                        ? 'bg-amber-50 text-amber-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>حسب المحافظة والمنطقة</span>
                    {groupBy === 'governorate' && (
                      <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setGroupBy('merchant');
                      setShowGroupByMenu(false);
                    }}
                    className={`w-full text-right px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-between ${
                      groupBy === 'merchant'
                        ? 'bg-amber-50 text-amber-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>حسب المتجر / التاجر</span>
                    {groupBy === 'merchant' && (
                      <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setGroupBy('driver');
                      setShowGroupByMenu(false);
                    }}
                    className={`w-full text-right px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-between ${
                      groupBy === 'driver'
                        ? 'bg-amber-50 text-amber-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>حسب السائق / المندوب</span>
                    {groupBy === 'driver' && <CheckSquare className="w-3.5 h-3.5 text-amber-600" />}
                  </button>
                </div>
              )}
            </div>

            {/* Clear active filters button */}
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 hover:bg-rose-50 rounded"
              >
                إلغاء كل الفلاتر
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { X, Layers, Plus, Trash2, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { User } from '../types/logistics';
import { GOVERNORATES } from '../utils/logisticsHelpers';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (batchOrders: any[]) => void;
  merchants: User[];
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  merchants,
}) => {
  const [rows, setRows] = useState([
    {
      recipientName: 'دانا المجالي',
      recipientPhone: '0791100223',
      governorate: 'عمان',
      area: 'الصويفية',
      totalCollection: 32.0,
      deliveryFee: 3.0,
      merchantId: merchants[0]?.id || '',
      notes: 'دفعة سريعة 1',
    },
    {
      recipientName: 'طارق حداد',
      recipientPhone: '0788997766',
      governorate: 'إربد',
      area: 'شارع الجامعة',
      totalCollection: 48.5,
      deliveryFee: 2.5,
      merchantId: merchants[1]?.id || merchants[0]?.id || '',
      notes: 'دفعة سريعة 2',
    },
    {
      recipientName: 'ليلى شقير',
      recipientPhone: '0775522331',
      governorate: 'الزرقاء',
      area: 'الزرقاء الجديدة',
      totalCollection: 20.0,
      deliveryFee: 2.5,
      merchantId: merchants[2]?.id || merchants[0]?.id || '',
      notes: 'دفعة سريعة 3',
    },
  ]);

  if (!isOpen) return null;

  const addRow = () => {
    setRows([
      ...rows,
      {
        recipientName: '',
        recipientPhone: '',
        governorate: 'عمان',
        area: '',
        totalCollection: 25.0,
        deliveryFee: 3.0,
        merchantId: merchants[0]?.id || '',
        notes: '',
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: string, value: any) => {
    const updated = [...rows];
    (updated[index] as any)[field] = value;
    setRows(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) {
      alert('يرجى إضافة طلبية واحدة على الأقل');
      return;
    }
    // Simple validation
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].recipientName || !rows[i].recipientPhone || !rows[i].area) {
        alert(`يرجى إكمال بيانات السطر رقم ${i + 1} (الاسم، الهاتف، والمنطقة)`);
        return;
      }
    }
    onSubmit(rows);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">استيراد وإضافة دفعة طلبيات (Bulk Batch)</h3>
              <p className="text-xs text-slate-400">
                إضافة عدة طرود دفعة واحدة لتاجر أو عدة متاجر لتسريع العمليات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600 font-medium">
              الطلبيات الجاهزة للإضافة:{' '}
              <strong className="text-slate-900">{rows.length} طلبية</strong>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة سطر جديد</span>
            </button>
          </div>

          {/* Rows Table */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[50vh]">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">اسم المستلم *</th>
                  <th className="p-2.5">رقم الهاتف (واتساب) *</th>
                  <th className="p-2.5">المحافظة</th>
                  <th className="p-2.5">المنطقة *</th>
                  <th className="p-2.5">مبلغ التحصيل (د.أ)</th>
                  <th className="p-2.5">التاجر</th>
                  <th className="p-2.5 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="p-2 font-mono text-slate-400 font-bold text-center">
                      {idx + 1}
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        required
                        value={row.recipientName}
                        onChange={(e) => updateRow(idx, 'recipientName', e.target.value)}
                        placeholder="اسم المستلم"
                        className="w-full border border-slate-300 rounded p-1 text-xs bg-white text-slate-800"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        required
                        value={row.recipientPhone}
                        onChange={(e) => updateRow(idx, 'recipientPhone', e.target.value)}
                        placeholder="079XXXXXXX"
                        className="w-full border border-slate-300 rounded p-1 text-xs font-mono bg-white text-slate-800"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={row.governorate}
                        onChange={(e) => updateRow(idx, 'governorate', e.target.value)}
                        className="border border-slate-300 rounded p-1 text-xs bg-white text-slate-800"
                      >
                        {GOVERNORATES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        required
                        value={row.area}
                        onChange={(e) => updateRow(idx, 'area', e.target.value)}
                        placeholder="المنطقة"
                        className="w-full border border-slate-300 rounded p-1 text-xs bg-white text-slate-800"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.5"
                        value={row.totalCollection}
                        onChange={(e) =>
                          updateRow(idx, 'totalCollection', parseFloat(e.target.value) || 0)
                        }
                        className="w-20 border border-slate-300 rounded p-1 text-xs font-mono font-bold bg-white text-slate-900"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={row.merchantId}
                        onChange={(e) => updateRow(idx, 'merchantId', e.target.value)}
                        className="border border-slate-300 rounded p-1 text-xs bg-white text-slate-800 max-w-[130px]"
                      >
                        {merchants.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.commercialName || m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        disabled={rows.length <= 1}
                        className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              * سيتم إنشاء أرقام بوالص فريدة تلقائياً (ORD-2026-XXXX) لكل طرد.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ واستيراد الدفعة ({rows.length})</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Info } from 'lucide-react';
import { AuditLogRecord } from '../../types/logistics';
import { getAuthHeaders } from '../../lib/auth';

export const RecentActivitySection: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAuditLogs = async () => {
      try {
        const res = await fetch('/api/audit-logs', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.logs)) {
            setLogs(data.logs);
          }
        }
      } catch {
        // Silently handle error; empty state will be displayed
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAuditLogs();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-xs" dir="rtl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">سجل النشاط والأحداث المنظومية</h3>
            <p className="text-[10px] text-slate-400">جاري تحميل الأحداث الحية من قاعدة البيانات...</p>
          </div>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-xs" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">سجل النشاط والأحداث المنظومية</h3>
              <p className="text-[10px] text-slate-400">السجل الحي للعمليات والإجراءات الإدارية</p>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">تدقيق حي</span>
        </div>
        <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-center space-y-1">
          <Info className="w-5 h-5 text-slate-500 mx-auto" />
          <p className="text-xs font-bold text-slate-300">لا توجد سجلات نشاط حية حالياً</p>
          <p className="text-[10px] text-slate-400">سيتم تسجيل كافة إجراءات التراخيص والمستخدمين تلقائياً عند حدوثها.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-xs" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">سجل النشاط والأحداث المنظومية</h3>
            <p className="text-[10px] text-slate-400">آخر التحديثات وعمليات الترخيص في المنصة ({logs.length})</p>
          </div>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">تدقيق حي</span>
      </div>

      <div className="space-y-2 pt-1">
        {logs.slice(0, 4).map((log) => (
          <div
            key={log.id}
            className="p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="font-bold text-slate-200 truncate">
                  {log.actionNameAr || log.action}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {log.performerName ? `بواسطة: ${log.performerName}` : ''} {log.targetName ? `• ${log.targetName}` : ''}
                </div>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


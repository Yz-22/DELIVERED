import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, Server, Database, ShieldCheck, RefreshCw } from 'lucide-react';

export const SystemHealthStrip: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<'ok' | 'checking' | 'error'>('checking');
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  const checkHealth = async () => {
    setHealthStatus('checking');
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok') {
          setHealthStatus('ok');
          setLastCheckTime(
            data.time
              ? new Date(data.time).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : new Date().toLocaleTimeString('ar-JO')
          );
          return;
        }
      }
      setHealthStatus('error');
    } catch {
      setHealthStatus('error');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs" dir="rtl">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Server & API Status - Proven by /api/health */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">حالة المنظومة والـ API:</span>
            {healthStatus === 'checking' ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> جاري الفحص...
              </span>
            ) : healthStatus === 'ok' ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> تعمل بشكل طبيعي (HTTP 200 OK)
              </span>
            ) : (
              <span className="text-rose-400 font-bold">غير متصل</span>
            )}
          </div>
        </div>
      </div>

      {/* Timestamp & Re-check Button */}
      <div className="flex items-center gap-3 shrink-0">
        {lastCheckTime && (
          <span className="text-[11px] text-slate-400 font-mono">
            آخر استجابة: {lastCheckTime}
          </span>
        )}
        <button
          type="button"
          onClick={checkHealth}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="إعادة فحص الاتصال"
          aria-label="إعادة فحص الاتصال"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${healthStatus === 'checking' ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};

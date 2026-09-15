import React, { useState, useEffect } from 'react';
import {
  X,
  Code2,
  Key,
  Webhook,
  Copy,
  Check,
  Plus,
  Play,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';
import { User, ApiKey } from '../types/logistics';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchants: User[];
  onOrderCreatedFromWebhook: () => void;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  isOpen,
  onClose,
  merchants,
  onOrderCreatedFromWebhook,
}) => {
  const [activeTab, setActiveTab] = useState<'webhooks' | 'api_keys' | 'docs'>('webhooks');
  const [selectedMerchantId, setSelectedMerchantId] = useState(merchants[0]?.id || 'u-mer-1');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // New Key Form State
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPlatform, setNewKeyPlatform] = useState<'SHOPIFY' | 'WOOCOMMERCE' | 'SALLA' | 'ZID' | 'CUSTOM'>('SHOPIFY');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  useEffect(() => {
    if (isOpen && selectedMerchantId) {
      fetchKeys(selectedMerchantId);
    }
  }, [isOpen, selectedMerchantId]);

  const fetchKeys = async (merchantId: string) => {
    setIsLoadingKeys(true);
    try {
      const res = await fetch(`/api/merchants/${merchantId}/integrations`);
      const data = await res.json();
      if (res.ok) {
        setApiKeys(data.apiKeys || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setIsGeneratingKey(true);
    try {
      const res = await fetch(`/api/merchants/${selectedMerchantId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          platform: newKeyPlatform,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setApiKeys((prev) => [...prev, data.apiKey]);
        setNewKeyName('');
      }
    } catch {
      // ignore
    } finally {
      setIsGeneratingKey(false);
    }
  };

  if (!isOpen) return null;

  const currentMerchant = merchants.find((m) => m.id === selectedMerchantId) || merchants[0];
  const webhookUrl = `https://dargo.olivery.io/api/webhooks/orders?merchant_token=${selectedMerchantId}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                  E-Commerce REST API & Webhooks
                </span>
                <span className="text-[10px] text-slate-400">Shopify / Salla / WooCommerce</span>
              </div>
              <h3 className="text-base sm:text-lg font-black mt-0.5">
                لوحة الربط البرمجي ومفاتيح المتاجر الإلكترونية
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Merchant Selector Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span>المتجر النشط للإعدادات:</span>
            <select
              value={selectedMerchantId}
              onChange={(e) => setSelectedMerchantId(e.target.value)}
              className="p-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
            >
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.commercialName || m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'webhooks' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الويب هوك (Webhooks)
            </button>
            <button
              onClick={() => setActiveTab('api_keys')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'api_keys' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مفاتيح API Keys
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'docs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              توثيق الربط البرمجي
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: WEBHOOKS */}
          {activeTab === 'webhooks' && (
            <div className="space-y-5">
              {/* Webhook URL Box */}
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Webhook className="w-4 h-4" />
                    <span>رابط الاستقبال التلقائي الفعلي (Webhook Endpoint URL):</span>
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                    POST / JSON
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <code className="text-xs text-slate-200 font-mono flex-1 overflow-x-auto select-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={() => handleCopy(webhookUrl)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  >
                    {copiedText === webhookUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === webhookUrl ? 'تم النسخ' : 'نسخ الرابط'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  انسخ هذا الرابط وضعه في إعدادات Notifications/Webhooks داخل متجرك الإلكتروني في Shopify أو سلة أو ووكومرس عند حدوث حدث <strong>Order Creation</strong> ليتم إصدار بوليصة الشحن تلقائياً فور طلب العميل.
                </p>
              </div>

              {/* Webhook Production Payload Specifications */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-amber-600" />
                    <span>هيكل حزمة البيانات الرسمية (Production Webhook Payload Schema):</span>
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                    Content-Type: application/json
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    يرسل المتجر الإلكتروني طلباً عبر بروتوكول HTTP POST إلى رابط الـ Webhook متضمناً تفاصيل العميل، العنوان، والمبلغ المطلوب تحصيله نقداً عند التسليم (COD).
                  </p>

                  <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800" dir="ltr">
{`{
  "merchantId": "${selectedMerchantId}",
  "customerName": "سناء الكردي",
  "phone": "0795554321",
  "governorate": "عمان",
  "area": "عبدون",
  "address": "عمان، عبدون، شارع دمشق، عمارة 14",
  "codAmount": 42.00,
  "itemsDescription": "حقيبة جلدية فاخرة",
  "notes": "الاتصال قبل الوصول بساعة"
}`}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-xs font-bold text-slate-900 mb-1">استجابة النجاح (201 Created)</div>
                      <div className="text-[11px] text-slate-600">
                        يقوم النظام بحفظ الطلب وإصدار رقم التتبع والبوليصة ورمز OTP للاستلام، وإرجاع بيانات الشحنة فوراً.
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-xs font-bold text-slate-900 mb-1">الأمان والتحقق (Security)</div>
                      <div className="text-[11px] text-slate-600">
                        يتم التحقق من الـ Token الخاص بالتاجر والتأكد من مطابقة صلاحيات الحساب وتفعيل الاشتراك.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: API KEYS */}
          {activeTab === 'api_keys' && (
            <div className="space-y-5">
              {/* Create API Key Form */}
              <form onSubmit={handleCreateKey} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-500" />
                  <span>توليد مفتاح API جديد لربط متجر:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      required
                      placeholder="اسم المفتاح (مثال: متجر شوبيفاي الرئيسي، ووكومرس، فرع التطبيق)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-semibold"
                    />
                  </div>
                  <div>
                    <select
                      value={newKeyPlatform}
                      onChange={(e: any) => setNewKeyPlatform(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                    >
                      <option value="SHOPIFY">Shopify</option>
                      <option value="WOOCOMMERCE">WooCommerce</option>
                      <option value="SALLA">منصة سلة (Salla)</option>
                      <option value="ZID">منصة زد (Zid)</option>
                      <option value="CUSTOM">تطبيق مخصص (Custom App)</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isGeneratingKey}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isGeneratingKey ? 'جاري التوليد...' : 'توليد المفتاح'}</span>
                  </button>
                </div>
              </form>

              {/* Keys List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>المفاتيح النشطة للمتجر ({apiKeys.length})</span>
                  <span className="text-[11px] text-slate-500">مشفرة برمجياً</span>
                </div>
                {isLoadingKeys ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-bold">جاري تحميل المفاتيح...</div>
                ) : apiKeys.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    لا توجد مفاتيح API لهذا المتجر بعد. قم بتوليد مفتاحك الأول أعلاه.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {apiKeys.map((k) => (
                      <div key={k.id} className="p-4 space-y-2 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">{k.name}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                              {k.platform}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            أنشئ: {new Date(k.createdAt).toLocaleDateString('ar-JO')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-500 font-bold">API Key:</span>
                            <code className="text-xs font-mono text-slate-800 flex-1 truncate">{k.key}</code>
                            <button
                              onClick={() => handleCopy(k.key)}
                              className="text-slate-400 hover:text-slate-700 p-1"
                              title="نسخ"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-500 font-bold">API Secret:</span>
                            <code className="text-xs font-mono text-slate-800 flex-1 truncate">{k.secret}</code>
                            <button
                              onClick={() => handleCopy(k.secret)}
                              className="text-slate-400 hover:text-slate-700 p-1"
                              title="نسخ"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: REST API REFERENCE DOCS */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black text-amber-400">إنشاء شحنة برمجياً (Create Shipment)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                    POST /api/orders
                  </span>
                </div>
                <pre className="text-[11px] font-mono bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto text-slate-300">
{`curl -X POST https://dargo.olivery.io/api/orders \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "merchantId": "${selectedMerchantId}",
    "recipientName": "سامي المجالي",
    "recipientPhone": "0791234567",
    "governorate": "عمان",
    "area": "خلدا",
    "fullAddress": "عمان - خلدا - قرب دوار الواحة",
    "merchantCollection": 45.0,
    "deliveryFee": 3.0,
    "packageType": "إلكترونيات"
  }'`}
                </pre>
              </div>

              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black text-amber-400">تتبع حالة شحنة بالباركود (Track Shipment)</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded border border-blue-500/30">
                    GET /api/orders/track/:sequence
                  </span>
                </div>
                <pre className="text-[11px] font-mono bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto text-slate-300">
{`curl -X GET https://dargo.olivery.io/api/orders/track/ORD-2026-1001`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>متوافق مع بروتوكولات REST API و Webhooks العالمية</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

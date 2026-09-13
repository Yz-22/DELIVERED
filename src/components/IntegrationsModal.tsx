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

  // Webhook Simulator State
  const [simCustomerName, setSimCustomerName] = useState('سناء الكردي');
  const [simPhone, setSimPhone] = useState('0795554321');
  const [simArea, setSimArea] = useState('عبدون');
  const [simCod, setSimCod] = useState('42.0');
  const [simItem, setSimItem] = useState('ساعة يد فاخرة + طقم هدايا');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

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

  const handleSimulateWebhook = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const res = await fetch('/api/webhooks/shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: selectedMerchantId,
          customerName: simCustomerName,
          phone: simPhone,
          governorate: 'عمان',
          area: simArea,
          address: `عمان، ${simArea}، مجمع الروابي التجاري`,
          codAmount: parseFloat(simCod) || 40,
          itemsDescription: simItem,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimulationResult(data);
        onOrderCreatedFromWebhook();
      }
    } catch {
      // ignore
    } finally {
      setIsSimulating(false);
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
          {/* TAB 1: WEBHOOKS & SIMULATOR */}
          {activeTab === 'webhooks' && (
            <div className="space-y-5">
              {/* Webhook URL Box */}
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Webhook className="w-4 h-4" />
                    <span>رابط الاستقبال التلقائي (Webhook Endpoint URL):</span>
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
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 shrink-0 transition-colors"
                  >
                    {copiedText === webhookUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === webhookUrl ? 'تم النسخ' : 'نسخ الرابط'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  انسخ هذا الرابط وضعه في إعدادات Notifications/Webhooks داخل لوحة تحكم Shopify أو سلة عند حدوث حدث <strong>Order Creation</strong> ليتم إصدار البوليصة تلقائياً فور طلب الزبون.
                </p>
              </div>

              {/* Live Webhook Simulator */}
              <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/40 border border-amber-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>محاكاة وصول طلب حقيقي من متجر إلكتروني (Live Webhook Test):</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      جرّب إرسال طلب تجريبي لترى كيف يستقبله نظام DarGo ويُنشئ له بوليصة شحن وباركود فوراً.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateWebhook}
                    disabled={isSimulating}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{isSimulating ? 'جاري الاستقبال...' : 'إرسال طلب تجريبي الآن'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الزبون:</label>
                    <input
                      type="text"
                      value={simCustomerName}
                      onChange={(e) => setSimCustomerName(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">هاتف الزبون:</label>
                    <input
                      type="text"
                      value={simPhone}
                      onChange={(e) => setSimPhone(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">المنطقة:</label>
                    <input
                      type="text"
                      value={simArea}
                      onChange={(e) => setSimArea(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">المبلغ المطلوب COD (د.أ):</label>
                    <input
                      type="number"
                      value={simCod}
                      onChange={(e) => setSimCod(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                </div>

                {simulationResult && (
                  <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl animate-in fade-in space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>نجح استقبال الطلب وتوليد البوليصة عبر الويب هوك:</span>
                      </span>
                      <span className="text-xs font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-200">
                        {simulationResult.order?.sequence}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700">
                      تم إنشاء الشحنة تلقائياً لحساب (<strong>{currentMerchant?.commercialName || currentMerchant?.name}</strong>) وتم تعيين رمز تحقق الاستلام POD: <strong className="font-mono text-amber-700">{simulationResult.order?.deliveryOtp}</strong>
                    </div>
                  </div>
                )}
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

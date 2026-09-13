import React from 'react';
import {
  Clock,
  Truck,
  CheckCircle2,
  CalendarClock,
  MessageSquare,
  Printer,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Order, OrderStatus, User } from '../types/logistics';
import {
  formatCurrency,
  formatWhatsAppUrl,
  buildRecipientWhatsAppMessage,
  STATUS_CONFIG,
} from '../utils/logisticsHelpers';

interface KanbanBoardProps {
  orders: Order[];
  onViewDetails: (order: Order) => void;
  onPrintWaybill: (order: Order) => void;
  onChangeStatus: (orderId: string, status: OrderStatus) => void;
  drivers: User[];
}

const COLUMNS: { id: OrderStatus; title: string; color: string }[] = [
  { id: 'PENDING', title: 'بالانتظار والتجهيز', color: 'border-t-amber-500 bg-amber-50/20' },
  { id: 'PICKING', title: 'جاري الاستلام من المتجر', color: 'border-t-blue-500 bg-blue-50/20' },
  { id: 'OUT_FOR_DELIVERY', title: 'مع المناديب للتوصيل', color: 'border-t-indigo-500 bg-indigo-50/20' },
  { id: 'POSTPONED', title: 'مؤجل من العميل', color: 'border-t-orange-500 bg-orange-50/20' },
  { id: 'DELIVERED', title: 'تم التسليم بنجاح', color: 'border-t-emerald-500 bg-emerald-50/20' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  orders,
  onViewDetails,
  onPrintWaybill,
  onChangeStatus,
  drivers,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colOrders = orders.filter((o) => o.status === col.id);
        const colTotalCOD = colOrders.reduce((sum, o) => sum + (o.totalCollection || 0), 0);

        return (
          <div
            key={col.id}
            className={`flex flex-col bg-slate-100/90 rounded-xl border border-slate-200 border-t-4 ${col.color} p-3 min-h-[500px] shadow-xs`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
              <div>
                <h3 className="font-extrabold text-xs text-slate-800">{col.title}</h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {formatCurrency(colTotalCOD)}
                </span>
              </div>
              <span className="w-5 h-5 rounded-full bg-white text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-300">
                {colOrders.length}
              </span>
            </div>

            {/* Column Order Cards */}
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[70vh] pr-0.5">
              {colOrders.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  لا توجد طلبات في هذه الحالة
                </div>
              ) : (
                colOrders.map((order) => {
                  const recipientMsg = buildRecipientWhatsAppMessage(
                    order.recipientName,
                    order.sequence,
                    order.totalCollection,
                    `${order.governorate} - ${order.area}`
                  );
                  const recipientWhatsAppUrl = formatWhatsAppUrl(
                    order.recipientPhone,
                    recipientMsg
                  );

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs hover:shadow-md transition-shadow space-y-2 relative group"
                    >
                      {/* Top Sequence & Print */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onViewDetails(order)}
                          className="font-mono font-bold text-xs text-amber-700 hover:underline"
                        >
                          {order.sequence}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onPrintWaybill(order)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                            title="طباعة"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onViewDetails(order)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                            title="تفاصيل"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Recipient info */}
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          {order.recipientName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {order.recipientPhone}
                        </div>
                      </div>

                      {/* Destination */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-600">
                        <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="truncate">
                          {order.governorate} - {order.area}
                        </span>
                      </div>

                      {/* Financials and Driver */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                        <span className="font-extrabold font-mono text-emerald-800">
                          {formatCurrency(order.totalCollection)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px]">
                          {order.driver?.name?.split(' ')[0] || 'بدون سائق'}
                        </span>
                      </div>

                      {/* Quick Action Footer: WhatsApp & Move */}
                      <div className="flex items-center justify-between pt-1 gap-1">
                        <a
                          href={recipientWhatsAppUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                        >
                          <MessageSquare className="w-3 h-3 fill-current" />
                          <span>واتساب</span>
                        </a>

                        {/* Quick state transitions */}
                        {order.status === 'PENDING' && (
                          <button
                            onClick={() => onChangeStatus(order.id, 'OUT_FOR_DELIVERY')}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[10px] font-bold"
                          >
                            خروج للتوصيل ←
                          </button>
                        )}
                        {order.status === 'OUT_FOR_DELIVERY' && (
                          <button
                            onClick={() => onChangeStatus(order.id, 'DELIVERED')}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-bold"
                          >
                            تم التسليم ✓
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

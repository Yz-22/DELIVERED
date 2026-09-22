import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { User, Order, OrderStatus, Role } from '../../types/logistics';
import { CreateOrderModal } from '../CreateOrderModal';
import { QuickOrderModal } from '../QuickOrderModal';
import { BatchImportModal } from '../BatchImportModal';
import { BarcodeScannerModal } from '../BarcodeScannerModal';
import { PublicTrackingModal } from '../PublicTrackingModal';
import { RouteOptimizerModal } from '../RouteOptimizerModal';
import { OrderDetailsDrawer } from '../OrderDetailsDrawer';
import { ThermalWaybillModal } from '../ThermalWaybillModal';
import { IntegrationsModal } from '../IntegrationsModal';
import { SchemaAndApiModal } from '../SchemaAndApiModal';
import { CliqPaymentModal } from '../CliqPaymentModal';

export interface ToastState {
  text: string;
  type: 'success' | 'error';
}

export interface GlobalOverlayLayerProps {
  // Modals visibility
  isCreateModalOpen: boolean;
  onCloseCreateModal: () => void;
  onSubmitCreateOrder: (data: any) => void;

  isQuickModalOpen: boolean;
  onCloseQuickModal: () => void;
  onSubmitQuickOrder: (data: any) => void;

  isBatchModalOpen: boolean;
  onCloseBatchModal: () => void;
  onSubmitBatchImport: (orders: any[]) => void;

  isScannerOpen: boolean;
  onCloseScanner: () => void;
  onScanSuccess: () => void;

  isTrackingOpen: boolean;
  onCloseTracking: () => void;

  isRouteOptimizerOpen: boolean;
  onCloseRouteOptimizer: () => void;
  onAppliedOptimization: () => void;

  isIntegrationsOpen: boolean;
  onCloseIntegrations: () => void;
  onOrderCreatedFromWebhook: () => void;

  isSchemaModalOpen: boolean;
  onCloseSchemaModal: () => void;

  // Drawer / Waybill / CliQ
  activeOrderDetails: Order | null;
  onCloseOrderDetails: () => void;
  onPrintSingleWaybill: (order: Order) => void;
  onChangeOrderStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  onAssignDriver: (orderId: string, driverId: string) => void;
  onOpenCliqPayment: (order: Order) => void;

  activeWaybillOrders: Order[] | null;
  onCloseWaybillModal: () => void;

  cliqOrder: Order | null;
  onCloseCliqPayment: () => void;
  onCliqSuccess: (updatedOrder: Order) => void;

  // Shared Data
  merchants: User[];
  drivers: User[];
  currentUser?: User | null;
  onAddNewUser?: (data: Partial<User>) => Promise<User | null>;

  // Toast
  toastMessage: ToastState | null;
  onCloseToast: () => void;
}

export const GlobalOverlayLayer: React.FC<GlobalOverlayLayerProps> = ({
  isCreateModalOpen,
  onCloseCreateModal,
  onSubmitCreateOrder,
  isQuickModalOpen,
  onCloseQuickModal,
  onSubmitQuickOrder,
  isBatchModalOpen,
  onCloseBatchModal,
  onSubmitBatchImport,
  isScannerOpen,
  onCloseScanner,
  onScanSuccess,
  isTrackingOpen,
  onCloseTracking,
  isRouteOptimizerOpen,
  onCloseRouteOptimizer,
  onAppliedOptimization,
  isIntegrationsOpen,
  onCloseIntegrations,
  onOrderCreatedFromWebhook,
  isSchemaModalOpen,
  onCloseSchemaModal,
  activeOrderDetails,
  onCloseOrderDetails,
  onPrintSingleWaybill,
  onChangeOrderStatus,
  onAssignDriver,
  onOpenCliqPayment,
  activeWaybillOrders,
  onCloseWaybillModal,
  cliqOrder,
  onCloseCliqPayment,
  onCliqSuccess,
  merchants,
  drivers,
  currentUser,
  onAddNewUser,
  toastMessage,
  onCloseToast,
}) => {
  return (
    <>
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl bg-slate-900 text-white text-xs font-bold border border-slate-800 animate-in fade-in slide-in-from-bottom-2 select-none"
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="leading-snug">{toastMessage.text}</span>
          <button
            type="button"
            onClick={onCloseToast}
            aria-label="إغلاق التنبيه"
            className="text-slate-400 hover:text-white ms-2 p-1 rounded-md transition-colors focus-ring cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={onCloseCreateModal}
        onSubmit={onSubmitCreateOrder}
        merchants={merchants}
        drivers={drivers}
        onAddNewMerchant={onAddNewUser}
      />

      {/* 2. Quick Order Modal */}
      <QuickOrderModal
        isOpen={isQuickModalOpen}
        onClose={onCloseQuickModal}
        onSubmit={onSubmitQuickOrder}
        merchants={merchants}
        onAddNewMerchant={onAddNewUser}
      />

      {/* 3. Batch Import Modal */}
      <BatchImportModal
        isOpen={isBatchModalOpen}
        onClose={onCloseBatchModal}
        onSubmit={onSubmitBatchImport}
        merchants={merchants}
      />

      {/* 4. Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={onCloseScanner}
        drivers={drivers}
        currentUser={currentUser}
        onScanSuccess={onScanSuccess}
      />

      {/* 5. Public Tracking Modal */}
      <PublicTrackingModal
        isOpen={isTrackingOpen}
        onClose={onCloseTracking}
      />

      {/* 6. Route Optimizer Modal */}
      <RouteOptimizerModal
        isOpen={isRouteOptimizerOpen}
        onClose={onCloseRouteOptimizer}
        drivers={drivers}
        onAppliedOptimization={onAppliedOptimization}
      />

      {/* 7. Order Details Drawer */}
      <OrderDetailsDrawer
        order={activeOrderDetails}
        isOpen={!!activeOrderDetails}
        onClose={onCloseOrderDetails}
        onPrintWaybill={onPrintSingleWaybill}
        onChangeStatus={onChangeOrderStatus}
        onAssignDriver={onAssignDriver}
        onOpenCliqPayment={onOpenCliqPayment}
        drivers={drivers}
        userRole={currentUser?.role}
        currentUser={currentUser}
      />

      {/* 8. Thermal Waybill Modal */}
      <ThermalWaybillModal
        orders={activeWaybillOrders}
        isOpen={!!activeWaybillOrders && activeWaybillOrders.length > 0}
        onClose={onCloseWaybillModal}
      />

      {/* 9. Integrations Modal */}
      <IntegrationsModal
        isOpen={isIntegrationsOpen}
        onClose={onCloseIntegrations}
        merchants={merchants}
        onOrderCreatedFromWebhook={onOrderCreatedFromWebhook}
      />

      {/* 10. Schema & API Docs Modal */}
      <SchemaAndApiModal
        isOpen={isSchemaModalOpen}
        onClose={onCloseSchemaModal}
      />

      {/* 11. CliQ Jordan Payment Modal */}
      <CliqPaymentModal
        isOpen={!!cliqOrder}
        order={cliqOrder}
        onClose={onCloseCliqPayment}
        onSuccess={onCliqSuccess}
      />
    </>
  );
};

import React, { useState } from 'react';
import {
  PackageCheck,
  Scan,
  Truck,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
  MapPin,
  Barcode,
  Calendar,
  Filter,
  Building2,
} from 'lucide-react';
import { Order, User, OrderStatus } from '../types/logistics';
import { formatCurrency, formatDate } from '../utils/logisticsHelpers';
import { HubOperationsWorkspace } from './HubOperationsWorkspace';

interface StaffPortalProps {
  orders: Order[];
  drivers: User[];
  onOpenScanner: () => void;
  onOpenWaybill: (order: Order) => void;
  onOpenWaybillBatch?: (orders: Order[]) => void;
  onChangeOrderStatus: (orderId: string, status: OrderStatus) => void;
  onAssignDriver: (orderId: string, driverId: string) => void;
}

export const StaffPortal: React.FC<StaffPortalProps> = ({
  orders,
  drivers,
  onOpenScanner,
  onOpenWaybill,
  onOpenWaybillBatch,
  onChangeOrderStatus,
  onAssignDriver,
}) => {
  const [viewMode, setViewMode] = useState<'HUB_OPERATIONS' | 'LEGACY_TABLE'>('HUB_OPERATIONS');

  return (
    <div className="space-y-4" dir="rtl">
      {/* Hub Operations Workspace */}
      <HubOperationsWorkspace
        orders={orders}
        drivers={drivers}
        onOpenScanner={onOpenScanner}
        onOpenWaybill={onOpenWaybill}
        onOpenWaybillBatch={onOpenWaybillBatch}
      />
    </div>
  );
};


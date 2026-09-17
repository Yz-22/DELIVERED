// =============================================================
// Delivere TMS/POS - Multi-Branch Types & Interfaces
// =============================================================

export interface MerchantBranch {
  id: string;
  merchantId: string;
  tenantId?: string | null;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
  governorate?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantStockTransfer {
  id: string;
  merchantId: string;
  tenantId?: string | null;
  productId: string;
  productName?: string;
  sourceBranchId: string;
  sourceBranchName?: string;
  destBranchId: string;
  destBranchName?: string;
  quantity: number;
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BranchInventorySummary {
  branchId: string;
  branchName: string;
  quantity: number;
}

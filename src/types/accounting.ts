export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  type: AccountType;
  category: string;
  balance: number;
  isDebitNormal?: boolean;
  normalBalance?: 'DEBIT' | 'CREDIT';
  description?: string;
}

export interface JournalEntryLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  note?: string;
  description?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string; // JE-2026-XXXX
  date: string;
  description: string;
  referenceType?: 'DELIVERY' | 'SETTLEMENT' | 'VOUCHER' | 'INVOICE' | 'MANUAL';
  referenceId?: string;
  reference?: string;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  createdByName?: string;
  createdAt: string;
}

export interface Voucher {
  id: string;
  voucherNumber: string; // V-REC-XXXX or V-PAY-XXXX
  type: 'RECEIPT' | 'PAYMENT'; // قبض أو صرف
  date: string;
  amount: number;
  beneficiaryOrPayer: string;
  partyName?: string;
  paymentMethod: 'CASH' | 'CLIQ' | 'BANK_TRANSFER' | 'CHEQUE' | 'BANK';
  referenceNumber?: string;
  reference?: string;
  accountId: string;
  contraAccountId?: string;
  notes: string;
  status: 'POSTED' | 'DRAFT';
  createdAt: string;
}

export interface TrialBalanceItem {
  accountId: string;
  code: string;
  nameAr?: string;
  name?: string;
  type: AccountType;
  debit: number;
  credit: number;
}

export interface AccountingOverview {
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  trialBalance: TrialBalanceItem[];
}

export interface MerchantProduct {
  id: string;
  merchantId: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  minStockAlert: number;
  unit: string;
  locationRack?: string;
  notes?: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  merchantId: string;
  productId: string;
  productName: string;
  type: 'IN_PURCHASE' | 'OUT_SALE' | 'OUT_SHIPPING' | 'IN_RETURN' | 'ADJUSTMENT';
  quantity: number; // positive or negative
  previousStock: number;
  newStock: number;
  unitPrice: number;
  referenceNumber: string;
  notes?: string;
  createdAt: string;
}

export interface MerchantInvoiceItem {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  total: number;
}

export interface MerchantInvoice {
  id: string;
  merchantId: string;
  invoiceNumber: string;
  type: 'SALES' | 'PURCHASE' | 'RETURN';
  date: string;
  partyName: string;
  partyPhone?: string;
  partyAddress?: string;
  items: MerchantInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  deliveryFee?: number;
  grandTotal: number;
  paymentMethod: 'CASH' | 'CLIQ' | 'CARD' | 'COD' | 'CREDIT';
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  shippingOrderId?: string;
  shippingTrackingNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface MerchantExpense {
  id: string;
  merchantId: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: 'CASH' | 'CLIQ' | 'BANK' | 'CARD';
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface MerchantFinancialSummary {
  merchantId: string;
  totalRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  marginPercent: number;
  deliveryFeesPaid: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPercent: number;
  pendingSettlements: number;
  inventoryAssetValue?: number;
  inventoryRetailValue?: number;
  totalStockItems?: number;
  lowStockCount?: number;
  accountsReceivable?: number;
  accountsPayable?: number;
}

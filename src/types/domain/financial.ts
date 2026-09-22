/**
 * DELIVERE - CORE DOMAIN CONTRACT: FINANCIAL DTOs & CALCULATIONS
 *
 * Establishes strict financial DTO boundaries and formula authorities.
 *
 * Core Financial Rule:
 * When a merchant creates a COD order, the merchant enters "Amount to Collect from Customer" (customerTotalToCollect).
 * This total ALREADY INCLUDES the delivery fee.
 *
 * Formula:
 * merchantCollection = customerTotalToCollect - deliveryFee
 */

export interface CustomerOrderFinancialDTO {
  trackingNumber: string;
  totalCollection: number; // Customer pays this amount
  currency: string;
}

export interface DriverOrderFinancialDTO {
  id: string;
  trackingNumber: string;
  referenceNumber?: string;
  recipientName: string;
  recipientPhone: string;
  secondaryPhone?: string;
  governorate: string;
  city?: string;
  area?: string;
  address: string;
  parcelType?: string;
  notes?: string;
  status: string;
  
  totalCollection: number; // AMOUNT TO COLLECT FROM CUSTOMER (Includes Delivery Fee)
  driverFee?: number; // Driver's own earning where policy permits
  currency: string;

  // STRICTLY EXCLUDED FROM DRIVER DTO:
  // - deliveryFee (Merchant delivery fee charged by company)
  // - merchantCollection (Merchant payable)
  // - pricePlanId / priceList
  // - companyRevenue / companyMargin
}

export interface MerchantOrderFinancialDTO {
  id: string;
  trackingNumber: string;
  referenceNumber?: string;

  totalCollection: number; // Amount to Collect from Customer (Inclusive of delivery fee)
  deliveryFee: number; // Delivery fee charged by delivery company based on price plan
  merchantCollection: number; // Net amount payable to merchant = totalCollection - deliveryFee
  currency: string;

  isSettledWithMerchant: boolean;
  merchantSettlementId?: string;
}

export interface AdminOrderFinancialDTO extends MerchantOrderFinancialDTO {
  driverFee: number; // Driver earning cost
  returnFee: number;
  companyNetRevenue: number; // = deliveryFee
  companyGrossMargin: number; // = deliveryFee - driverFee
  pricePlanId?: string;
  priceList?: string;
}

/**
 * Calculates net merchant collection from inclusive customer total and server-derived delivery fee.
 */
export function calculateMerchantCollection(customerTotalToCollect: number, deliveryFee: number): number {
  const safeTotal = Math.max(0, Number(customerTotalToCollect) || 0);
  const safeFee = Math.max(0, Number(deliveryFee) || 0);
  return Math.max(0, safeTotal - safeFee);
}

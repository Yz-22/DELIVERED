/**
 * DELIVERE - CORE DOMAIN CONTRACT: CHAIN OF CUSTODY
 *
 * Establishes the domain contracts for physical custody handoffs and auditability.
 *
 * Core Principle:
 * Every physical handoff of a shipment (Merchant -> Driver -> Hub -> Driver -> Customer)
 * records explicit custody transitions with location, scan evidence, and actor IDs.
 */

export type CustodyHolderType =
  | 'MERCHANT'
  | 'DRIVER'
  | 'HUB_BRANCH'
  | 'TRANSFER_VEHICLE'
  | 'CUSTOMER'
  | 'RETURN_PROCESSING';

export interface CustodyHolder {
  type: CustodyHolderType;
  id: string;
  name: string;
  phone?: string;
  branchId?: string;
}

export interface CustodyEvidence {
  otpVerified?: boolean;
  otpCode?: string;
  signatureUrl?: string;
  photoUrl?: string;
  barcodeScanValue?: string;
  manifestId?: string;
  notes?: string;
}

export interface CustodyEvent {
  id: string;
  shipmentId: string;
  legId?: string;
  tenantId: string;

  fromHolder: CustodyHolder;
  toHolder: CustodyHolder;

  actorUserId: string; // The user executing the transfer
  actorRole: string;

  latitude?: number;
  longitude?: number;
  accuracy?: number;

  evidence?: CustodyEvidence;

  timestamp: string;
}

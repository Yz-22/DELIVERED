/**
 * DELIVERE — OPERATIONAL LOGISTICS SERVICE (PHASE 3C / STEP 1)
 *
 * Authoritative Server-Side Operational Transaction & Read Engine.
 * Backed by Phase 3B PostgreSQL tables:
 *   - operational_facilities
 *   - user_facility_access
 *   - shipment_legs
 *   - shipment_leg_assignments
 *   - custody_events
 *   - shipment_current_custody
 *   - operational_manifests
 *   - manifest_items
 *   - customer_payment_records
 *   - driver_cash_collections
 *   - shipment_events
 *   - financial_obligations
 *
 * INVARIANTS:
 * 1. Strict Tenant Isolation on all reads and writes.
 * 2. Authenticated Context authoritative; client parameters never trusted for identity or tenant.
 * 3. Assignment does NOT change parcel custody.
 * 4. Scan resolver is strictly non-mutating.
 * 5. Driver response privacy: no tariffs, company margins, or other driver earnings.
 * 6. Cash collections strictly recorded ONLY for physical cash.
 * 7. Multi-table atomic mutations REQUIRE real PostgreSQL transaction boundaries (RPC).
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// 1. ERROR MODEL
// ============================================================================

export type OperationalErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'TENANT_MISMATCH'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_SUSPENDED'
  | 'ACTOR_NOT_FOUND'
  | 'ACTOR_INACTIVE'
  | 'ACTOR_TENANT_MISMATCH'
  | 'ACTOR_NOT_AUTHORIZED'
  | 'ACTOR_FACILITY_ACCESS_DENIED'
  | 'FACILITY_ACCESS_DENIED'
  | 'SHIPMENT_NOT_FOUND'
  | 'LEG_NOT_FOUND'
  | 'MANIFEST_NOT_FOUND'
  | 'TARGET_DRIVER_INVALID'
  | 'DRIVER_NOT_ASSIGNED'
  | 'DRIVER_MISMATCH'
  | 'ORIGIN_FACILITY_MISMATCH'
  | 'DESTINATION_FACILITY_MISMATCH'
  | 'BRANCH_MISMATCH'
  | 'DESTINATION_MISMATCH'
  | 'CUSTODY_MISMATCH'
  | 'CUSTODY_BRANCH_MISMATCH'
  | 'INVALID_LEG_STATE'
  | 'INVALID_SHIPMENT_STATE'
  | 'INVALID_LEG_TYPE'
  | 'EVIDENCE_REQUIRED'
  | 'NEGATIVE_AMOUNT'
  | 'PAYMENT_METHOD_MISMATCH'
  | 'PREPAID_PAYMENT_NONZERO'
  | 'PAYMENT_METHOD_INVALID'
  | 'SHORT_PAYMENT_NOT_ALLOWED'
  | 'CLIQ_REFERENCE_REQUIRED'
  | 'IDEMPOTENCY_REPLAY_MISMATCH'
  | 'MANIFEST_NOT_DRAFT'
  | 'CANNOT_SEAL_EMPTY_MANIFEST'
  | 'INCOMPATIBLE_MANIFEST_ITEM'
  | 'INCOMPATIBLE_ACTIVE_MANIFEST'
  | 'INVALID_SCAN'
  | 'INVALID_EVIDENCE'
  | 'DUPLICATE_OPERATION'
  | 'PAYMENT_MISMATCH'
  | 'MANIFEST_STATE_INVALID'
  | 'CONCURRENT_MODIFICATION'
  | 'ATOMIC_TRANSACTION_REQUIRED'
  | 'RETURN_REASON_REQUIRED'
  | 'ACTIVE_RETURN_ALREADY_EXISTS'
  | 'MERCHANT_BRANCH_REQUIRED'
  | 'MERCHANT_BRANCH_NOT_FOUND'
  | 'MERCHANT_BRANCH_INACTIVE'
  | 'MERCHANT_MISMATCH'
  | 'INVALID_PAYLOAD'
  | 'INTERNAL_ERROR'
  | 'SUPERVISOR_ROLE_REQUIRED'
  | 'TASK_NOT_FOUND'
  | 'EXCEPTION_NOT_FOUND'
  | 'TASK_NOT_CLAIMABLE'
  | 'TASK_ALREADY_CLAIMED'
  | 'STALE_TASK_VERSION'
  | 'INVALID_TASK_STATUS_TRANSITION'
  | 'QUERY_FAILED'
  | 'RPC_RESULT_INVALID';

export class OperationalError extends Error {
  public readonly code: OperationalErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, any>;

  constructor(code: OperationalErrorCode, message: string, httpStatus = 400, details?: Record<string, any>) {
    super(message);
    this.name = 'OperationalError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

/**
 * Extracts and classifies structured errors from PostgreSQL RPC execution results
 */
export function parseRpcError(rpcErr: any, defaultCode: OperationalErrorCode = 'INVALID_PAYLOAD'): OperationalError {
  if (!rpcErr) {
    return new OperationalError(defaultCode, 'Unknown operational database error', 400);
  }

  // Schema cache / function not found check
  if (rpcErr.code === 'PGRST202' || (typeof rpcErr.message === 'string' && rpcErr.message.includes('schema cache'))) {
    return new OperationalError(
      'ATOMIC_TRANSACTION_REQUIRED',
      'The requested operational transaction requires an atomic PostgreSQL RPC function.',
      503,
      { rpcError: rpcErr }
    );
  }

  const rawMsg = typeof rpcErr.message === 'string' ? rpcErr.message : String(rpcErr);
  const match = rawMsg.match(/^([A-Z0-9_]+):\s*(.*)$/);

  // If message itself is an exact code like 'TASK_ALREADY_CLAIMED' or starts with code
  let codeStr: OperationalErrorCode = defaultCode;
  let cleanMsg = rawMsg;

  if (match) {
    codeStr = match[1] as OperationalErrorCode;
    cleanMsg = match[2];
  } else if (/^[A-Z][A-Z0-9_]{3,}$/.test(rawMsg.trim())) {
    codeStr = rawMsg.trim() as OperationalErrorCode;
  } else if (rpcErr.code && typeof rpcErr.code === 'string') {
    codeStr = rpcErr.code as OperationalErrorCode;
  }

  let httpStatus = 400;
  if (['UNAUTHENTICATED', 'ACTOR_NOT_FOUND'].includes(codeStr)) {
    httpStatus = 401;
  } else if ([
    'FORBIDDEN',
    'TENANT_NOT_FOUND',
    'TENANT_SUSPENDED',
    'ACTOR_INACTIVE',
    'ACTOR_TENANT_MISMATCH',
    'ACTOR_NOT_AUTHORIZED',
    'ACTOR_FACILITY_ACCESS_DENIED',
    'FACILITY_ACCESS_DENIED',
    'MERCHANT_BRANCH_INACTIVE',
    'MERCHANT_MISMATCH',
    'UNAUTHORIZED_DRIVER_ASSIGNMENT',
    'SUPERVISOR_ROLE_REQUIRED',
  ].includes(codeStr)) {
    httpStatus = 403;
  } else if (['SHIPMENT_NOT_FOUND', 'LEG_NOT_FOUND', 'MANIFEST_NOT_FOUND', 'MERCHANT_BRANCH_NOT_FOUND', 'TASK_NOT_FOUND', 'EXCEPTION_NOT_FOUND'].includes(codeStr)) {
    httpStatus = 404;
  } else if ([
    'IDEMPOTENCY_REPLAY_MISMATCH',
    'CUSTODY_MISMATCH',
    'CUSTODY_BRANCH_MISMATCH',
    'INVALID_LEG_STATE',
    'INVALID_SHIPMENT_STATE',
    'INVALID_LEG_TYPE',
    'ACTIVE_RETURN_ALREADY_EXISTS',
    'MANIFEST_NOT_DRAFT',
    'CANNOT_SEAL_EMPTY_MANIFEST',
    'INCOMPATIBLE_MANIFEST_ITEM',
    'INCOMPATIBLE_ACTIVE_MANIFEST',
    'DUPLICATE_OPERATION',
    'CONCURRENT_MODIFICATION',
    'TASK_ALREADY_CLAIMED',
    'STALE_TASK_VERSION',
  ].includes(codeStr)) {
    httpStatus = 409;
  } else if (['RETURN_REASON_REQUIRED', 'MERCHANT_BRANCH_REQUIRED', 'DESTINATION_REQUIRED'].includes(codeStr)) {
    httpStatus = 400;
  }

  // Sanitize: Do not leak raw database details, hints, or internal SQL schema
  return new OperationalError(codeStr, cleanMsg, httpStatus);
}

// ============================================================================
// 2. AUTHENTICATED CONTEXT & TYPES
// ============================================================================

export interface AuthenticatedOperationContext {
  actorUserId: string;
  tenantId: string;
  role: string;
  permissions: string[];
  isSuperAdmin?: boolean;
}

export type CanonicalOperationalAction =
  | 'CONFIRM_MERCHANT_PICKUP'
  | 'CONFIRM_FACILITY_INTAKE'
  | 'CONFIRM_FACILITY_RELEASE'
  | 'COMPLETE_CUSTOMER_DELIVERY'
  | 'RECORD_DELIVERY_FAILURE'
  | 'SEAL_MANIFEST'
  | 'INITIATE_RETURN'
  | 'CONFIRM_CUSTOMER_RETURN_PICKUP'
  | 'CONFIRM_MERCHANT_RETURN_RECEIPT';

export interface OperationalActionRequirements {
  barcodeRequired?: boolean;
  otpRequired?: boolean;
  paymentReferenceRequired?: boolean;
  reasonRequired?: boolean;
  sealNumberRequired?: boolean;
  signatureRequired?: boolean;
  photoRequired?: boolean;
  amountExpected?: number | null;
  paymentType?: string | null;
}

export interface OperationalActionDescriptor {
  action: CanonicalOperationalAction;
  label: string;
  description: string;
  destructive?: boolean;
  requirements: OperationalActionRequirements;
  payloadTemplate: Record<string, any>;
}

export interface IdentificationResponse {
  type: 'SHIPMENT' | 'MANIFEST' | 'UNKNOWN';
  id?: string;
  code: string;
  context?: Record<string, any>;
  availableActions: OperationalActionDescriptor[];
  notes?: string;
}

export type AllowedOperationalAction =
  | 'CONFIRM_PICKUP'
  | 'FACILITY_INTAKE'
  | 'FACILITY_RELEASE'
  | 'MANIFEST_ADD'
  | 'DELIVERY_COMPLETE'
  | 'DELIVERY_FAILURE'
  | 'INITIATE_RETURN';

export interface ScanResolutionResult {
  entityType: 'SHIPMENT' | 'MANIFEST';
  entityId: string;
  trackingNumber?: string;
  shipmentId?: string;
  manifestId?: string;
  manifestNumber?: string;
  currentLeg?: {
    id: string;
    sequence: number;
    legType: string;
    status: string;
    assignedDriverId?: string | null;
    originFacilityId?: string | null;
    originMerchantBranchId?: string | null;
    destinationFacilityId?: string | null;
    destinationMerchantBranchId?: string | null;
    destinationIsCustomer?: boolean;
  } | null;
  currentCustody?: {
    currentHolderType: string;
    currentFacilityId?: string | null;
    currentMerchantBranchId?: string | null;
    currentDriverId?: string | null;
    currentIsCustomer?: boolean;
    isTerminalCustomerCustody?: boolean;
    lastHandoffAt?: string | null;
    version: number;
  } | null;
  allowedActions: AllowedOperationalAction[];
  notes?: string;
}

export interface LegAssignmentParams {
  legId: string;
  driverId: string;
  notes?: string;
}

export interface ConfirmPickupParams {
  shipmentId: string;
  legId: string;
  merchantBranchId?: string;
  evidenceBarcode?: string;
  evidenceOtp?: string;
  evidenceType?: 'BARCODE_SCAN' | 'OTP_CODE' | 'MANUAL_OVERRIDE' | 'GEOFENCE' | 'SIGNATURE' | 'PHOTO';
  notes?: string;
  idempotencyKey: string;
  latitude?: number;
  longitude?: number;
}

export interface ConfirmFacilityIntakeParams {
  shipmentId: string;
  legId: string;
  facilityId: string;
  driverId: string;
  evidenceBarcode: string;
  notes?: string;
  idempotencyKey: string;
  latitude?: number;
  longitude?: number;
}

export interface ConfirmFacilityReleaseParams {
  shipmentId: string;
  legId: string;
  facilityId: string;
  targetDriverId: string;
  evidenceBarcode: string;
  notes?: string;
  idempotencyKey: string;
}

export interface CompleteDeliveryParams {
  shipmentId: string;
  legId: string;
  paymentMethod: 'CASH' | 'CLIQ' | 'PREPAID' | 'WALLET';
  amountExpected: number;
  amountPaid: number;
  currency?: string;
  cliqReference?: string;
  walletReference?: string;
  evidenceOtp?: string;
  evidenceSignatureUrl?: string;
  evidencePhotoUrl?: string;
  notes?: string;
  idempotencyKey: string;
  latitude?: number;
  longitude?: number;
}

export interface RecordDeliveryFailureParams {
  shipmentId: string;
  legId: string;
  reason: string;
  notes?: string;
  idempotencyKey: string;
}

export interface InitiateReturnParams {
  shipmentId: string;
  sourceLegId?: string;
  returnReason: string;
  destinationFacilityId?: string;
  destinationMerchantBranchId?: string;
  originFacilityId?: string;
  assignedDriverId?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface ConfirmCustomerReturnPickupParams {
  shipmentId: string;
  legId: string;
  driverId?: string;
  evidenceBarcode?: string;
  evidenceOtp?: string;
  notes?: string;
  idempotencyKey?: string;
  latitude?: number;
  longitude?: number;
  evidenceType?: 'BARCODE' | 'OTP' | 'MANUAL_OVERRIDE';
}

export interface ConfirmMerchantReturnReceiptParams {
  shipmentId: string;
  legId: string;
  merchantBranchId?: string;
  evidenceBarcode?: string;
  evidenceSignatureUrl?: string;
  notes?: string;
  idempotencyKey?: string;
  evidenceType?: 'SIGNATURE' | 'BARCODE' | 'MANUAL_OVERRIDE';
}

export interface CreateManifestParams {
  manifestType: 'PICKUP' | 'HUB_TRANSFER' | 'DRIVER_RUNSHEET' | 'RETURN';
  originFacilityId?: string;
  destinationFacilityId?: string;
  assignedDriverId?: string;
  notes?: string;
}

// ============================================================================
// 3. OPERATIONAL LOGISTICS SERVICE IMPLEMENTATION
// ============================================================================

export class OperationalLogisticsService {
  constructor(private readonly supabase: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // AUTH CONTEXT VALIDATION
  // --------------------------------------------------------------------------

  private validateContext(ctx: AuthenticatedOperationContext): void {
    if (!ctx || !ctx.actorUserId) {
      throw new OperationalError('UNAUTHENTICATED', 'يجب تسجيل الدخول لتنفيذ هذه العملية.', 401);
    }
    if (!ctx.tenantId) {
      throw new OperationalError('TENANT_MISMATCH', 'معرّف المستأجر غير صالح أو مفقود في سياق الجلسة.', 403);
    }
  }

  // --------------------------------------------------------------------------
  // READ MODELS
  // --------------------------------------------------------------------------

  /**
   * Returns the full operational journey of a shipment (legs, custody events, current custody, events)
   * Enforces tenant isolation.
   */
  async getShipmentOperationalJourney(shipmentId: string, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const [legsRes, custodyRes, eventsRes, currentCustodyRes] = await Promise.all([
      this.supabase
        .from('shipment_legs')
        .select('*')
        .eq('shipment_id', shipmentId)
        .eq('tenant_id', ctx.tenantId)
        .order('sequence', { ascending: true }),
      this.supabase
        .from('custody_events')
        .select('*')
        .eq('shipment_id', shipmentId)
        .eq('tenant_id', ctx.tenantId)
        .order('recorded_at', { ascending: true }),
      this.supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', shipmentId)
        .eq('tenant_id', ctx.tenantId)
        .order('created_at', { ascending: true }),
      this.supabase
        .from('shipment_current_custody')
        .select('*')
        .eq('shipment_id', shipmentId)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle(),
    ]);

    if (legsRes.error) {
      throw new OperationalError('SHIPMENT_NOT_FOUND', `خطأ في استرجاع مسار الشحنة: ${legsRes.error.message}`, 500);
    }

    return {
      shipmentId,
      tenantId: ctx.tenantId,
      currentCustody: currentCustodyRes.data || null,
      legs: legsRes.data || [],
      custodyHistory: custodyRes.data || [],
      events: eventsRes.data || [],
    };
  }

  /**
   * Fast projection read for current parcel custody
   */
  async getShipmentCurrentCustody(shipmentId: string, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const { data, error } = await this.supabase
      .from('shipment_current_custody')
      .select('*')
      .eq('shipment_id', shipmentId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (error) {
      throw new OperationalError('CUSTODY_MISMATCH', `فشل في قراءة عهدة الشحنة الحالية: ${error.message}`, 500);
    }

    return data;
  }

  /**
   * Reads all shipment legs for a shipment in strict sequence order
   */
  async getShipmentLegs(shipmentId: string, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const { data, error } = await this.supabase
      .from('shipment_legs')
      .select('*')
      .eq('shipment_id', shipmentId)
      .eq('tenant_id', ctx.tenantId)
      .order('sequence', { ascending: true });

    if (error) {
      throw new OperationalError('LEG_NOT_FOUND', `فشل في قراءة مسارات الشحنة: ${error.message}`, 500);
    }

    return data || [];
  }

  /**
   * Returns active legs assigned to a driver with strict privacy sanitization
   */
  async getDriverActiveLegs(driverId: string, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    // Privacy rule: drivers can only query their own active legs unless actor is admin/dispatcher
    const isSelf = ctx.actorUserId === driverId;
    const isPrivileged = ctx.isSuperAdmin || ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'DISPATCHER'].includes(ctx.role);

    if (!isSelf && !isPrivileged) {
      throw new OperationalError('FORBIDDEN', 'غير مصرح بالاطلاع على مسارات سائق آخر.', 403);
    }

    const { data, error } = await this.supabase
      .from('shipment_legs')
      .select('*')
      .eq('assigned_driver_id', driverId)
      .eq('tenant_id', ctx.tenantId)
      .in('status', ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'])
      .order('sequence', { ascending: true });

    if (error) {
      throw new OperationalError('LEG_NOT_FOUND', `فشل في استرجاع مهام السائق: ${error.message}`, 500);
    }

    // Sanitize driver view: strip company margins, tariffs, and internal financial snapshots
    return (data || []).map((leg) => this.sanitizeDriverOperationalView(leg));
  }

  /**
   * Returns authoritative DRIVER WORKLOAD (Stops, Load, Custody & Cash Summary)
   * Enforces strict privacy sanitization: zero exposure of merchant delivery fee,
   * merchant payables, margins, profits, or other drivers' data.
   */
  async getDriverWorkload(targetDriverId: string | undefined, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const isPrivileged = ctx.isSuperAdmin || ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'DISPATCHER'].includes(ctx.role);
    const effectiveDriverId = isPrivileged && targetDriverId ? targetDriverId : ctx.actorUserId;

    // 1. Fetch assigned shipment legs for this driver in this tenant
    const { data: rawLegs, error: legsErr } = await this.supabase
      .from('shipment_legs')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .eq('assigned_driver_id', effectiveDriverId)
      .in('status', ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'FAILED'])
      .order('sequence', { ascending: true });

    if (legsErr) {
      throw new OperationalError('INTERNAL_ERROR', `فشل في تحميل مهام السائق: ${legsErr.message}`, 500);
    }

    const legs = rawLegs || [];
    const shipmentIds = Array.from(new Set(legs.map((l: any) => l.shipment_id).filter(Boolean)));

    let shipmentsMap: Record<string, any> = {};
    let custodyMap: Record<string, any> = {};

    if (shipmentIds.length > 0) {
      // 2. Fetch authoritative shipment details (SANITIZED - strictly excluding merchant fees & margins)
      const { data: rawShipments } = await this.supabase
        .from('shipments')
        .select('id, sequence, tracking_number, status, payment_type, cod_amount, recipient_name, recipient_phone, recipient_phone_alt, governorate, area, sub_area, street_address, location_coordinates, notes, delivery_attempts, created_at')
        .eq('tenant_id', ctx.tenantId)
        .in('id', shipmentIds);

      (rawShipments || []).forEach((s: any) => {
        shipmentsMap[s.id] = s;
      });

      // 3. Fetch current physical custody
      const { data: rawCustody } = await this.supabase
        .from('shipment_current_custody')
        .select('shipment_id, current_holder_type, current_driver_id, current_facility_id, is_with_customer, is_verified_custody, updated_at')
        .eq('tenant_id', ctx.tenantId)
        .in('shipment_id', shipmentIds);

      (rawCustody || []).forEach((c: any) => {
        custodyMap[c.shipment_id] = c;
      });
    }

    // 4. Fetch Driver Cash Collections for this driver
    const { data: rawCash } = await this.supabase
      .from('driver_cash_collections')
      .select('id, shipment_id, leg_id, cash_amount, remittance_status, collected_at, created_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('driver_id', effectiveDriverId)
      .order('collected_at', { ascending: false });

    const cashRecords = rawCash || [];
    const heldCashRecords = cashRecords.filter((c: any) => c.remittance_status === 'HELD_BY_DRIVER');
    const totalCashHeld = heldCashRecords.reduce((sum: number, c: any) => sum + Number(c.cash_amount || 0), 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCashRecords = cashRecords.filter((c: any) => (c.collected_at || c.created_at || '').startsWith(todayStr));
    const totalTodayCollected = todayCashRecords.reduce((sum: number, c: any) => sum + Number(c.cash_amount || 0), 0);

    // 5. Build Stop DTOs
    const allStops = legs.map((leg: any) => {
      const ship = shipmentsMap[leg.shipment_id] || {};
      const cust = custodyMap[leg.shipment_id] || {};
      const isInDriverCustody = cust.current_holder_type === 'DRIVER' && cust.current_driver_id === effectiveDriverId;
      const isLastMile = ['LAST_MILE', 'DIRECT'].includes(leg.leg_type);
      const isReturn = leg.leg_type === 'RETURN';
      const isCustomerReturnPickup = isReturn && (leg.origin_is_shipment_customer || cust.is_with_customer);
      const isMerchantReturnHandoff = isReturn && (leg.destination_merchant_branch_id || !leg.origin_is_shipment_customer);
      const isEligibleForDelivery = isInDriverCustody && isLastMile && leg.status !== 'COMPLETED';
      const isEligibleForReturnPickup = !isInDriverCustody && isCustomerReturnPickup && ['ASSIGNED', 'ACCEPTED', 'READY'].includes(leg.status);
      const isEligibleForMerchantReceipt = isInDriverCustody && isMerchantReturnHandoff && leg.status !== 'COMPLETED';

      return {
        legId: leg.id,
        shipmentId: leg.shipment_id,
        sequence: ship.sequence || leg.sequence || '---',
        trackingNumber: ship.tracking_number || ship.sequence || '---',
        legType: leg.leg_type,
        legStatus: leg.status,
        shipmentStatus: ship.status || 'UNKNOWN',
        recipientName: ship.recipient_name || 'غير محدد',
        recipientPhone: ship.recipient_phone || '',
        recipientPhoneAlt: ship.recipient_phone_alt || '',
        governorate: ship.governorate || '',
        area: ship.area || '',
        subArea: ship.sub_area || '',
        streetAddress: ship.street_address || '',
        locationCoordinates: ship.location_coordinates || null,
        notes: ship.notes || leg.notes || '',
        paymentType: ship.payment_type || 'COD',
        codAmount: Number(ship.cod_amount ?? 0),
        deliveryAttempts: Number(ship.delivery_attempts ?? 0),
        failureReason: leg.failure_reason_code || null,
        failureNotes: leg.failure_notes || null,
        custody: {
          currentHolderType: cust.current_holder_type || 'UNKNOWN',
          currentDriverId: cust.current_driver_id || null,
          isWithCustomer: !!cust.is_with_customer,
          isInDriverCustody,
          isAtFacility: cust.current_holder_type === 'FACILITY',
        },
        isEligibleForDelivery,
        isEligibleForReturnPickup,
        isEligibleForMerchantReceipt,
        isLastMile,
        isReturn,
        isCustomerReturnPickup,
        isMerchantReturnHandoff,
        destinationMerchantBranchId: leg.destination_merchant_branch_id || null,
        plannedStartAt: leg.planned_start_at,
        plannedEndAt: leg.planned_end_at,
        actualStartAt: leg.actual_start_at,
        actualEndAt: leg.actual_end_at,
      };
    });

    const activeStops = allStops.filter((s) => ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'].includes(s.legStatus));
    const completedStops = allStops.filter((s) => s.legStatus === 'COMPLETED' || s.shipmentStatus === 'DELIVERED');
    const failedStops = allStops.filter((s) => s.legStatus === 'FAILED' || s.deliveryAttempts > 0);

    const heldInCustody = activeStops.filter((s) => s.custody.isInDriverCustody);
    const awaitingHandoff = activeStops.filter((s) => !s.custody.isInDriverCustody);

    const totalCodToCollect = heldInCustody.reduce((sum, s) => (s.paymentType === 'COD' ? sum + s.codAmount : sum), 0);

    return {
      driverId: effectiveDriverId,
      summary: {
        totalAssigned: activeStops.length,
        inCustodyCount: heldInCustody.length,
        awaitingHandoffCount: awaitingHandoff.length,
        completedCount: completedStops.length,
        failedCount: failedStops.length,
        totalCodToCollect,
        cashHeldAmount: totalCashHeld,
        todayCollectedAmount: totalTodayCollected,
      },
      myLoad: {
        heldInCustody,
        awaitingHandoff,
      },
      stops: activeStops,
      completedStops,
      failedStops,
      allStops,
      cashSummary: {
        totalHeld: totalCashHeld,
        todayCollected: totalTodayCollected,
        pendingRemittanceCount: heldCashRecords.length,
        recentCollections: cashRecords.slice(0, 20),
      },
    };
  }

  /**
   * Returns list of authorized facilities for the user/tenant
   */
  async getOperationalFacilities(ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const isPrivileged = ctx.isSuperAdmin || ['SUPER_ADMIN', 'ADMIN'].includes(ctx.role);

    if (isPrivileged) {
      const { data, error } = await this.supabase
        .from('operational_facilities')
        .select('*')
        .eq('tenant_id', ctx.tenantId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        throw new OperationalError('FACILITY_ACCESS_DENIED', `خطأ في قراءة المنشآت: ${error.message}`, 500);
      }
      return data || [];
    }

    // For branch/hub staff: query user_facility_access
    const { data: accessList, error: accessErr } = await this.supabase
      .from('user_facility_access')
      .select('facility_id, is_primary')
      .eq('user_id', ctx.actorUserId)
      .eq('tenant_id', ctx.tenantId);

    if (accessErr || !accessList || accessList.length === 0) {
      return [];
    }

    const facilityIds = accessList.map((a) => a.facility_id);
    const { data: facilities, error: facErr } = await this.supabase
      .from('operational_facilities')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .in('id', facilityIds)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (facErr) {
      throw new OperationalError('FACILITY_ACCESS_DENIED', `خطأ في قراءة المنشآت: ${facErr.message}`, 500);
    }

    return facilities || [];
  }

  /**
   * Reads operational queue for a specific facility (incoming & outgoing legs)
   */
  async getFacilityOperationalQueue(facilityId: string, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    // Validate facility access if actor is not an admin
    await this.assertUserFacilityAccess(ctx.actorUserId, facilityId, ctx);

    const [incomingRes, outgoingRes, custodyRes, manifestRes] = await Promise.all([
      this.supabase
        .from('shipment_legs')
        .select('*, shipment:shipments(id, sequence, barcode, status, recipient_name, recipient_phone, recipient_address, destination_city, total_collection, declared_value, payment_type, merchant_id)')
        .eq('destination_facility_id', facilityId)
        .eq('tenant_id', ctx.tenantId)
        .in('status', ['IN_TRANSIT', 'ACCEPTED', 'ASSIGNED'])
        .order('sequence', { ascending: true }),
      this.supabase
        .from('shipment_legs')
        .select('*, shipment:shipments(id, sequence, barcode, status, recipient_name, recipient_phone, recipient_address, destination_city, total_collection, declared_value, payment_type, merchant_id)')
        .eq('origin_facility_id', facilityId)
        .eq('tenant_id', ctx.tenantId)
        .in('status', ['READY', 'ASSIGNED', 'ACCEPTED'])
        .order('sequence', { ascending: true }),
      this.supabase
        .from('shipment_current_custody')
        .select('*, shipment:shipments(id, sequence, barcode, status, recipient_name, recipient_phone, recipient_address, destination_city, total_collection, declared_value, payment_type, merchant_id)')
        .eq('current_facility_id', facilityId)
        .eq('current_holder_type', 'FACILITY')
        .eq('tenant_id', ctx.tenantId),
      this.supabase
        .from('operational_manifests')
        .select('*')
        .eq('tenant_id', ctx.tenantId)
        .or(`source_facility_id.eq.${facilityId},destination_facility_id.eq.${facilityId}`)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (incomingRes.error || outgoingRes.error || custodyRes.error) {
      throw new OperationalError('FACILITY_ACCESS_DENIED', 'فشل في قراءة قائمة عمليات المنشأة', 500);
    }

    const inCustodyParcels = custodyRes.data || [];
    const incomingQueue = incomingRes.data || [];
    const outgoingQueue = outgoingRes.data || [];
    const manifests = manifestRes.data || [];

    // Sorting & Staging breakdown: group inCustody parcels by destination city/next leg
    const sortingMap: Record<string, any[]> = {};
    for (const item of inCustodyParcels) {
      const city = (item.shipment as any)?.destination_city || 'غير محدد';
      if (!sortingMap[city]) {
        sortingMap[city] = [];
      }
      sortingMap[city].push(item);
    }

    // Exceptions queue: inCustody shipments that are CANCELLED or FAILED
    const exceptionsQueue = inCustodyParcels.filter(
      (p) => (p.shipment as any)?.status === 'CANCELLED' || (p.shipment as any)?.status === 'FAILED'
    );

    return {
      facilityId,
      tenantId: ctx.tenantId,
      counts: {
        incoming: incomingQueue.length,
        receivedInCustody: inCustodyParcels.length,
        readyForDispatch: outgoingQueue.length,
        exceptions: exceptionsQueue.length,
        activeManifests: manifests.filter((m) => m.status === 'DRAFT' || m.status === 'SEALED').length,
      },
      incomingQueue,
      receivedQueue: inCustodyParcels,
      sortingQueue: sortingMap,
      outgoingQueue,
      exceptionsQueue,
      recentManifests: manifests,
    };
  }

  /**
   * Lists manifests with optional facility filter
   */
  async listOperationalManifests(facilityId: string | undefined, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    let query = this.supabase
      .from('operational_manifests')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false });

    if (facilityId) {
      query = query.or(`source_facility_id.eq.${facilityId},destination_facility_id.eq.${facilityId}`);
    }

    const { data, error } = await query;
    if (error) {
      throw new OperationalError('MANIFEST_STATE_INVALID', `خطأ في قراءة كشوفات المنفست: ${error.message}`, 500);
    }

    return data || [];
  }

  /**
   * Executes atomic bulk facility intake validating per-item
   */
  async bulkFacilityIntake(
    params: {
      facilityId: string;
      items: Array<{ barcode: string; legId?: string; driverId?: string; idempotencyKey?: string }>;
    },
    ctx: AuthenticatedOperationContext
  ) {
    this.validateContext(ctx);
    await this.assertUserFacilityAccess(ctx.actorUserId, params.facilityId, ctx);

    const results: Array<{
      barcode: string;
      status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
      message: string;
      shipmentId?: string;
      errorCode?: string;
    }> = [];

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const item of params.items) {
      const code = item.barcode?.trim()?.toUpperCase();
      if (!code) {
        results.push({ barcode: '', status: 'SKIPPED', message: 'رمز باركود فارغ' });
        skippedCount++;
        continue;
      }

      try {
        const { data: shipment } = await this.supabase
          .from('shipments')
          .select('*')
          .eq('tenant_id', ctx.tenantId)
          .or(`sequence.eq.${code},barcode.eq.${code},id.eq.${code}`)
          .maybeSingle();

        if (!shipment) {
          results.push({ barcode: code, status: 'FAILED', message: 'الشحنة غير موجودة', errorCode: 'SHIPMENT_NOT_FOUND' });
          failedCount++;
          continue;
        }

        let targetLegId = item.legId;
        if (!targetLegId) {
          const { data: legs } = await this.supabase
            .from('shipment_legs')
            .select('*')
            .eq('shipment_id', shipment.id)
            .eq('tenant_id', ctx.tenantId)
            .eq('destination_facility_id', params.facilityId)
            .in('status', ['IN_TRANSIT', 'ACCEPTED', 'ASSIGNED'])
            .order('sequence', { ascending: true });

          targetLegId = legs?.[0]?.id;
        }

        if (!targetLegId) {
          results.push({ barcode: code, status: 'SKIPPED', message: 'لا يوجد مسار نقل فعال متجه إلى هذه المنشأة', errorCode: 'INVALID_LEG_STATE' });
          skippedCount++;
          continue;
        }

        const itemKey = item.idempotencyKey || `bulk-intake-${shipment.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        await this.confirmFacilityIntake(
          {
            shipmentId: shipment.id,
            legId: targetLegId,
            facilityId: params.facilityId,
            driverId: item.driverId,
            evidenceBarcode: code,
            idempotencyKey: itemKey,
          },
          ctx
        );

        results.push({ barcode: code, status: 'SUCCESS', message: 'تم الاستلام بالمستودع وتحديث العهدة بنجاح', shipmentId: shipment.id });
        successCount++;
      } catch (err: any) {
        results.push({
          barcode: code,
          status: 'FAILED',
          message: err.message || 'فشلت عملية الاستلام بالمستودع',
          errorCode: err.code || 'INTAKE_FAILED',
        });
        failedCount++;
      }
    }

    return {
      facilityId: params.facilityId,
      total: params.items.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      results,
    };
  }

  /**
   * Executes atomic bulk facility release validating per-item
   */
  async bulkFacilityRelease(
    params: {
      facilityId: string;
      targetDriverId: string;
      items: Array<{ barcode: string; legId?: string; idempotencyKey?: string }>;
    },
    ctx: AuthenticatedOperationContext
  ) {
    this.validateContext(ctx);
    await this.assertUserFacilityAccess(ctx.actorUserId, params.facilityId, ctx);

    const results: Array<{
      barcode: string;
      status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
      message: string;
      shipmentId?: string;
      errorCode?: string;
    }> = [];

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const item of params.items) {
      const code = item.barcode?.trim()?.toUpperCase();
      if (!code) {
        results.push({ barcode: '', status: 'SKIPPED', message: 'رمز باركود فارغ' });
        skippedCount++;
        continue;
      }

      try {
        const { data: shipment } = await this.supabase
          .from('shipments')
          .select('*')
          .eq('tenant_id', ctx.tenantId)
          .or(`sequence.eq.${code},barcode.eq.${code},id.eq.${code}`)
          .maybeSingle();

        if (!shipment) {
          results.push({ barcode: code, status: 'FAILED', message: 'الشحنة غير موجودة', errorCode: 'SHIPMENT_NOT_FOUND' });
          failedCount++;
          continue;
        }

        let targetLegId = item.legId;
        if (!targetLegId) {
          const { data: legs } = await this.supabase
            .from('shipment_legs')
            .select('*')
            .eq('shipment_id', shipment.id)
            .eq('tenant_id', ctx.tenantId)
            .eq('origin_facility_id', params.facilityId)
            .in('status', ['READY', 'ASSIGNED', 'ACCEPTED'])
            .order('sequence', { ascending: true });

          targetLegId = legs?.[0]?.id;
        }

        if (!targetLegId) {
          results.push({ barcode: code, status: 'SKIPPED', message: 'لا يوجد مسار إخراج فعال من هذه المنشأة', errorCode: 'INVALID_LEG_STATE' });
          skippedCount++;
          continue;
        }

        const itemKey = item.idempotencyKey || `bulk-release-${shipment.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        await this.confirmFacilityRelease(
          {
            shipmentId: shipment.id,
            legId: targetLegId,
            facilityId: params.facilityId,
            targetDriverId: params.targetDriverId,
            evidenceBarcode: code,
            idempotencyKey: itemKey,
          },
          ctx
        );

        results.push({ barcode: code, status: 'SUCCESS', message: 'تم إخراج الشحنة وتسليم العهدة للكابتن بنجاح', shipmentId: shipment.id });
        successCount++;
      } catch (err: any) {
        results.push({
          barcode: code,
          status: 'FAILED',
          message: err.message || 'فشلت عملية الإخراج للكابتن',
          errorCode: err.code || 'RELEASE_FAILED',
        });
        failedCount++;
      }
    }

    return {
      facilityId: params.facilityId,
      targetDriverId: params.targetDriverId,
      total: params.items.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      results,
    };
  }

  /**
   * Reads a manifest and its items
   */
  async getManifestWithItems(manifestId: string, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const [manifestRes, itemsRes] = await Promise.all([
      this.supabase
        .from('operational_manifests')
        .select('*')
        .eq('id', manifestId)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle(),
      this.supabase
        .from('manifest_items')
        .select('*')
        .eq('manifest_id', manifestId)
        .eq('tenant_id', ctx.tenantId)
        .order('created_at', { ascending: true }),
    ]);

    if (manifestRes.error || !manifestRes.data) {
      throw new OperationalError('MANIFEST_STATE_INVALID', 'المنفست غير موجود أو غير تابع للمستأجر', 404);
    }

    return {
      ...manifestRes.data,
      items: itemsRes.data || [],
    };
  }

  // --------------------------------------------------------------------------
  // SCAN RESOLVER (STRICTLY READ-ONLY / NON-MUTATING)
  // --------------------------------------------------------------------------

  /**
   * Resolves a physical barcode or sequence scan value against active domain records.
   * Calculates allowedActions server-side based on context without mutating anything.
   */
  async resolveOperationalScan(
    scanValue: string,
    facilityIdOrContext: string | null | undefined,
    ctx: AuthenticatedOperationContext
  ): Promise<ScanResolutionResult> {
    this.validateContext(ctx);

    const cleanCode = scanValue?.trim()?.toUpperCase();
    if (!cleanCode) {
      throw new OperationalError('INVALID_SCAN', 'رمز الباركود المدخل فارغ', 400);
    }

    // 1. Check if scan value matches a Manifest Number
    const { data: manifest } = await this.supabase
      .from('operational_manifests')
      .select('id, manifest_number, manifest_type, status, origin_facility_id, destination_facility_id, assigned_driver_id')
      .eq('tenant_id', ctx.tenantId)
      .eq('manifest_number', cleanCode)
      .maybeSingle();

    if (manifest) {
      return {
        entityType: 'MANIFEST',
        entityId: manifest.id,
        manifestId: manifest.id,
        manifestNumber: manifest.manifest_number,
        allowedActions: [],
        notes: `منفست رسمي بحالة (${manifest.status})`,
      };
    }

    // 2. Resolve Shipment by sequence or tracking barcode
    const { data: shipment, error: shipErr } = await this.supabase
      .from('shipments')
      .select('id, sequence, barcode, merchant_id, driver_id, status, payment_type')
      .eq('tenant_id', ctx.tenantId)
      .or(`sequence.eq.${cleanCode},barcode.eq.${cleanCode}`)
      .maybeSingle();

    if (shipErr || !shipment) {
      throw new OperationalError('INVALID_SCAN', `لم يتم العثور على أي شحنة أو منفست مطابق للرمز (${cleanCode})`, 404);
    }

    // Role scoping: Merchant can only access and scan their own shipments
    if (ctx.role === 'MERCHANT' && shipment.merchant_id && shipment.merchant_id !== ctx.actorUserId) {
      throw new OperationalError('MERCHANT_MISMATCH', 'لا يمكن الوصول إلى شحنة تابعة لمتجر آخر', 403);
    }

    // 3. Fetch current custody and active leg for this shipment
    const [custodyRes, legsRes] = await Promise.all([
      this.supabase
        .from('shipment_current_custody')
        .select('*')
        .eq('shipment_id', shipment.id)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle(),
      this.supabase
        .from('shipment_legs')
        .select('*')
        .eq('shipment_id', shipment.id)
        .eq('tenant_id', ctx.tenantId)
        .order('sequence', { ascending: true }),
    ]);

    const currentCustody = custodyRes.data || null;
    const allLegs = legsRes.data || [];

    // Find the currently active leg (first non-completed, non-cancelled leg)
    const activeLeg = allLegs.find((l) => ['READY', 'ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'].includes(l.status)) || null;

    // Calculate allowed operational actions strictly based on current state & actor context
    const allowedActions: AllowedOperationalAction[] = [];
    const isDriver = ctx.role === 'DRIVER';
    // Validate actual permissions for OPERATOR rather than blind role matching
    const isFacilityStaff =
      ['SUPER_ADMIN', 'ADMIN', 'DISPATCHER'].includes(ctx.role) ||
      (ctx.role === 'OPERATOR' &&
        (ctx.permissions.includes('*') ||
          ctx.permissions.includes('shipments.dispatch') ||
          ctx.permissions.includes('returns.manage') ||
          ctx.permissions.length === 0));

    if (activeLeg) {
      // PICKUP: Parcel at merchant, leg is PICKUP or DIRECT, driver is assigned to leg
      if (
        ['PICKUP', 'DIRECT'].includes(activeLeg.leg_type) &&
        activeLeg.origin_merchant_branch_id &&
        (!currentCustody || currentCustody.current_holder_type === 'MERCHANT') &&
        ['ASSIGNED', 'ACCEPTED'].includes(activeLeg.status)
      ) {
        if (!isDriver || activeLeg.assigned_driver_id === ctx.actorUserId) {
          allowedActions.push('CONFIRM_PICKUP');
        }
      }

      // FACILITY INTAKE: Parcel in transit, driver has custody, arrived at destination facility
      if (
        currentCustody &&
        currentCustody.current_holder_type === 'DRIVER' &&
        activeLeg.destination_facility_id &&
        activeLeg.status === 'IN_TRANSIT'
      ) {
        if (isFacilityStaff && (!facilityIdOrContext || facilityIdOrContext === activeLeg.destination_facility_id)) {
          allowedActions.push('FACILITY_INTAKE');
        }
      }

      // FACILITY RELEASE: Parcel held at facility, driver assigned for next leg
      if (
        currentCustody &&
        currentCustody.current_holder_type === 'FACILITY' &&
        activeLeg.origin_facility_id &&
        ['ASSIGNED', 'ACCEPTED', 'READY'].includes(activeLeg.status)
      ) {
        if (isFacilityStaff && (!facilityIdOrContext || facilityIdOrContext === activeLeg.origin_facility_id)) {
          allowedActions.push('FACILITY_RELEASE');
          allowedActions.push('MANIFEST_ADD');
        }
      }

      // DELIVERY COMPLETE / FAILURE: Parcel held by driver on LAST_MILE or DIRECT leg
      if (
        currentCustody &&
        currentCustody.current_holder_type === 'DRIVER' &&
        ['LAST_MILE', 'DIRECT'].includes(activeLeg.leg_type) &&
        activeLeg.status === 'IN_TRANSIT'
      ) {
        if (!isDriver || activeLeg.assigned_driver_id === ctx.actorUserId) {
          allowedActions.push('DELIVERY_COMPLETE');
          allowedActions.push('DELIVERY_FAILURE');
        }
      }

      // INITIATE RETURN: Leg failed or customer refused
      if (activeLeg.status === 'FAILED' || currentCustody?.current_holder_type === 'DRIVER') {
        allowedActions.push('INITIATE_RETURN');
      }
    }

    return {
      entityType: 'SHIPMENT',
      entityId: shipment.id,
      trackingNumber: shipment.sequence,
      shipmentId: shipment.id,
      currentLeg: activeLeg
        ? {
            id: activeLeg.id,
            sequence: activeLeg.sequence,
            legType: activeLeg.leg_type,
            status: activeLeg.status,
            assignedDriverId: activeLeg.assigned_driver_id,
            originFacilityId: activeLeg.origin_facility_id,
            originMerchantBranchId: activeLeg.origin_merchant_branch_id,
            destinationFacilityId: activeLeg.destination_facility_id,
            destinationMerchantBranchId: activeLeg.destination_merchant_branch_id,
            destinationIsCustomer: activeLeg.destination_is_shipment_customer,
          }
        : null,
      currentCustody: currentCustody
        ? {
            currentHolderType: currentCustody.current_holder_type,
            currentFacilityId: currentCustody.current_facility_id,
            currentMerchantBranchId: currentCustody.current_merchant_branch_id,
            currentDriverId: currentCustody.current_driver_id,
            currentIsCustomer: currentCustody.current_is_customer,
            isTerminalCustomerCustody: currentCustody.is_terminal_customer_custody,
            lastHandoffAt: currentCustody.last_handoff_at,
            version: currentCustody.version,
          }
        : null,
      allowedActions,
      notes: `شحنة رقم ${shipment.sequence}`,
    };
  }

  /**
   * Unified Operational Identifier (Scan Anything Layer).
   * Resolves any barcode/code to SHIPMENT, MANIFEST, or UNKNOWN.
   * Derives role-aware availableActions and enforces driver financial privacy.
   */
  async identifyOperationalEntity(
    code: string,
    facilityIdOrContext: string | null | undefined,
    ctx: AuthenticatedOperationContext
  ): Promise<IdentificationResponse> {
    this.validateContext(ctx);

    const cleanCode = code?.trim()?.toUpperCase();
    if (!cleanCode) {
      return {
        type: 'UNKNOWN',
        code: '',
        availableActions: [],
        notes: 'رمز المسح المدخل فارغ',
      };
    }

    const isDriver = ctx.role === 'DRIVER';
    const isFacilityStaff =
      ['SUPER_ADMIN', 'ADMIN', 'DISPATCHER'].includes(ctx.role) ||
      (ctx.role === 'OPERATOR' &&
        (ctx.permissions.includes('*') ||
          ctx.permissions.includes('shipments.dispatch') ||
          ctx.permissions.includes('warehouse.view') ||
          ctx.permissions.length === 0));
    const isSuperAdmin = ctx.isSuperAdmin || ctx.role === 'SUPER_ADMIN';

    // 1. Check if scan value matches a Manifest (by manifest_number or id)
    const { data: manifest } = await this.supabase
      .from('operational_manifests')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .or(`manifest_number.eq.${cleanCode},id.eq.${cleanCode}`)
      .maybeSingle();

    if (manifest) {
      const { count: itemCount } = await this.supabase
        .from('manifest_items')
        .select('*', { count: 'exact', head: true })
        .eq('manifest_id', manifest.id)
        .eq('tenant_id', ctx.tenantId);

      const availableActions: OperationalActionDescriptor[] = [];

      // Manifest Seal action
      if (manifest.status === 'DRAFT' && (isFacilityStaff || isSuperAdmin)) {
        availableActions.push({
          action: 'SEAL_MANIFEST',
          label: 'إغلاق وتشميع المنفست (Seal Manifest)',
          description: 'تشميع المنفست وتحويله إلى وثيقة رسمية مغلقة غير قابلة للتعديل',
          destructive: false,
          requirements: {
            sealNumberRequired: true,
          },
          payloadTemplate: {
            manifestId: manifest.id,
            sealNumber: `SEAL-${Math.floor(100000 + Math.random() * 900000)}`,
          },
        });
      }

      return {
        type: 'MANIFEST',
        id: manifest.id,
        code: manifest.manifest_number,
        context: {
          manifestId: manifest.id,
          manifestNumber: manifest.manifest_number,
          manifestType: manifest.manifest_type,
          status: manifest.status,
          originFacilityId: manifest.origin_facility_id,
          destinationFacilityId: manifest.destination_facility_id,
          assignedDriverId: manifest.assigned_driver_id,
          sealedAt: manifest.sealed_at,
          sealNumber: manifest.seal_number,
          itemCount: itemCount || 0,
          notes: manifest.notes,
        },
        availableActions,
        notes: `منفست رسمي رقم ${manifest.manifest_number} بحالة (${manifest.status})`,
      };
    }

    // 2. Check if scan value matches a Shipment
    const { data: shipment } = await this.supabase
      .from('shipments')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .or(`sequence.eq.${cleanCode},barcode.eq.${cleanCode},id.eq.${cleanCode}`)
      .maybeSingle();

    if (!shipment) {
      // Return UNKNOWN safely without leaking whether another tenant owns this code
      return {
        type: 'UNKNOWN',
        code: cleanCode,
        availableActions: [],
        notes: `لم يتم العثور على أي شحنة أو منفست مسجل بالرمز (${cleanCode})`,
      };
    }

    // 3. Load shipment current custody and all multi-leg records
    const [custodyRes, legsRes] = await Promise.all([
      this.supabase
        .from('shipment_current_custody')
        .select('*')
        .eq('shipment_id', shipment.id)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle(),
      this.supabase
        .from('shipment_legs')
        .select('*')
        .eq('shipment_id', shipment.id)
        .eq('tenant_id', ctx.tenantId)
        .order('sequence', { ascending: true }),
    ]);

    const currentCustody = custodyRes.data || null;
    const allLegs = legsRes.data || [];
    const activeLeg = allLegs.find((l) => ['READY', 'ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'].includes(l.status)) || null;

    const availableActions: OperationalActionDescriptor[] = [];

    if (activeLeg) {
      // A. CONFIRM_MERCHANT_PICKUP
      if (
        ['PICKUP', 'DIRECT'].includes(activeLeg.leg_type) &&
        activeLeg.origin_merchant_branch_id &&
        (!currentCustody || currentCustody.current_holder_type === 'MERCHANT') &&
        ['ASSIGNED', 'ACCEPTED', 'READY'].includes(activeLeg.status)
      ) {
        if (!isDriver || activeLeg.assigned_driver_id === ctx.actorUserId) {
          availableActions.push({
            action: 'CONFIRM_MERCHANT_PICKUP',
            label: 'تأكيد الاستلام من التاجر (Merchant Pickup)',
            description: 'نقل عهدة الطرد الفيزيائية من التاجر إلى السائق المعين',
            destructive: false,
            requirements: {
              barcodeRequired: true,
              otpRequired: false,
            },
            payloadTemplate: {
              shipmentId: shipment.id,
              legId: activeLeg.id,
              merchantBranchId: activeLeg.origin_merchant_branch_id,
              evidenceBarcode: shipment.barcode || shipment.sequence,
            },
          });
        }
      }

      // B. CONFIRM_FACILITY_INTAKE
      if (
        currentCustody &&
        currentCustody.current_holder_type === 'DRIVER' &&
        activeLeg.destination_facility_id &&
        activeLeg.status === 'IN_TRANSIT'
      ) {
        if ((isFacilityStaff || isSuperAdmin) && (!facilityIdOrContext || facilityIdOrContext === activeLeg.destination_facility_id)) {
          availableActions.push({
            action: 'CONFIRM_FACILITY_INTAKE',
            label: 'تأكيد استلام بالمستودع / الهب (Facility Intake)',
            description: 'نقل عهدة الطرد من السائق إلى المستودع وفرزه رسمياً',
            destructive: false,
            requirements: {
              barcodeRequired: true,
            },
            payloadTemplate: {
              shipmentId: shipment.id,
              legId: activeLeg.id,
              facilityId: activeLeg.destination_facility_id,
              driverId: currentCustody.current_driver_id || activeLeg.assigned_driver_id,
              evidenceBarcode: shipment.barcode || shipment.sequence,
            },
          });
        }
      }

      // C. CONFIRM_FACILITY_RELEASE
      if (
        currentCustody &&
        currentCustody.current_holder_type === 'FACILITY' &&
        activeLeg.origin_facility_id &&
        ['ASSIGNED', 'ACCEPTED', 'READY'].includes(activeLeg.status)
      ) {
        if ((isFacilityStaff || isSuperAdmin) && (!facilityIdOrContext || facilityIdOrContext === activeLeg.origin_facility_id)) {
          availableActions.push({
            action: 'CONFIRM_FACILITY_RELEASE',
            label: 'تأكيد إخراج وتسليم للكابتن (Facility Release)',
            description: 'إخراج الطرد من المستودع وتسليم عهدته لسائق المسار التالي',
            destructive: false,
            requirements: {
              barcodeRequired: true,
            },
            payloadTemplate: {
              shipmentId: shipment.id,
              legId: activeLeg.id,
              facilityId: activeLeg.origin_facility_id,
              targetDriverId: activeLeg.assigned_driver_id,
              evidenceBarcode: shipment.barcode || shipment.sequence,
            },
          });
        }
      }

      // D. COMPLETE_CUSTOMER_DELIVERY
      if (
        currentCustody &&
        currentCustody.current_holder_type === 'DRIVER' &&
        ['LAST_MILE', 'DIRECT'].includes(activeLeg.leg_type) &&
        activeLeg.status === 'IN_TRANSIT'
      ) {
        if (!isDriver || activeLeg.assigned_driver_id === ctx.actorUserId) {
          const codExpected = shipment.payment_type === 'COD' ? Number(shipment.declared_value || shipment.total_collection || 0) : 0;
          availableActions.push({
            action: 'COMPLETE_CUSTOMER_DELIVERY',
            label: 'إتمام التسليم النهائي للزبون (Customer Delivery)',
            description: 'تأكيد تسليم الطرد للزبون وتسجيل الدفعة المالية والعهدة النهائية',
            destructive: false,
            requirements: {
              otpRequired: false,
              paymentReferenceRequired: shipment.payment_type === 'CLIQ',
              amountExpected: codExpected,
              paymentType: shipment.payment_type || 'COD',
            },
            payloadTemplate: {
              shipmentId: shipment.id,
              legId: activeLeg.id,
              paymentMethod: shipment.payment_type || 'COD',
              amountExpected: codExpected,
              amountPaid: codExpected,
              currency: 'JOD',
            },
          });

          // E. RECORD_DELIVERY_FAILURE
          availableActions.push({
            action: 'RECORD_DELIVERY_FAILURE',
            label: 'تسجيل تعذر تسليم (Delivery Failure)',
            description: 'توثيق محاولة تسليم غير مكتملة مع تسجيل السبب والعهدة المحفوظة',
            destructive: true,
            requirements: {
              reasonRequired: true,
            },
            payloadTemplate: {
              shipmentId: shipment.id,
              legId: activeLeg.id,
              reason: 'CUSTOMER_UNREACHABLE',
              notes: 'محاولة تسليم غير مكتملة',
            },
          });
        }
      }

      // F. CONFIRM_CUSTOMER_RETURN_PICKUP
      if (
        activeLeg.leg_type === 'RETURN' &&
        (activeLeg.origin_is_shipment_customer || currentCustody?.is_with_customer || !currentCustody || currentCustody.current_holder_type === 'CUSTOMER') &&
        ['ASSIGNED', 'ACCEPTED', 'READY'].includes(activeLeg.status)
      ) {
        if (!isDriver || activeLeg.assigned_driver_id === ctx.actorUserId) {
          availableActions.push({
            action: 'CONFIRM_CUSTOMER_RETURN_PICKUP',
            label: 'استلام مرتجع من العميل (Customer Return Pickup)',
            description: 'استلام الطرد المرتجع من العميل ونقل العهدة إلى الكابتن لبدء رحلة العودة',
            destructive: false,
            requirements: {
              barcodeRequired: true,
              otpRequired: false,
            },
            payloadTemplate: {
              shipmentId: shipment.id,
              legId: activeLeg.id,
              driverId: activeLeg.assigned_driver_id || ctx.actorUserId,
              evidenceBarcode: shipment.barcode || shipment.sequence,
            },
          });
        }
      }

      // G. CONFIRM_MERCHANT_RETURN_RECEIPT
      if (
        activeLeg.leg_type === 'RETURN' &&
        (activeLeg.destination_merchant_branch_id || !activeLeg.destination_is_shipment_customer) &&
        ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'].includes(activeLeg.status)
      ) {
        const isOwningMerchant = ctx.role === 'MERCHANT' && (!shipment.merchant_id || shipment.merchant_id === ctx.actorUserId);
        if (!isDriver || activeLeg.assigned_driver_id === ctx.actorUserId || isFacilityStaff || isSuperAdmin || isOwningMerchant) {
          availableActions.push({
            action: 'CONFIRM_MERCHANT_RETURN_RECEIPT',
            label: 'تأكيد تسليم المرتجع للتاجر (Merchant Return Receipt)',
            description: 'تأكيد استلام التاجر للطرد المرتجع في الفرع وإغلاق مسار الشحنة كـ RETURNED',
            destructive: false,
            requirements: {
              barcodeRequired: true,
              signatureRequired: false,
            },
            payloadTemplate: {
              shipmentId: shipment.id,
              legId: activeLeg.id,
              merchantBranchId: activeLeg.destination_merchant_branch_id,
              evidenceBarcode: shipment.barcode || shipment.sequence,
            },
          });
        }
      }
    }

    // Return initiation eligibility check
    const hasActiveReturnLeg = allLegs.some((l) => l.leg_type === 'RETURN' && ['PLANNED', 'READY', 'ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'].includes(l.status));
    const isEligibleToInitiateReturn = shipment.status !== 'CANCELLED' && shipment.status !== 'RETURNED' && !hasActiveReturnLeg;
    const isOwningMerchant = ctx.role === 'MERCHANT' && (!shipment.merchant_id || shipment.merchant_id === ctx.actorUserId);
    const canInitiateReturnRole = isFacilityStaff || isSuperAdmin || isOwningMerchant || (isDriver && activeLeg?.status === 'FAILED');

    if (isEligibleToInitiateReturn && canInitiateReturnRole) {
      availableActions.push({
        action: 'INITIATE_RETURN',
        label: 'بدء مسار إرجاع للشحنة (Initiate Return)',
        description: 'إنشاء مسار إرجاع رسمي وموثق للشحنة يربطها بفرع التاجر المستهدف',
        destructive: false,
        requirements: {
          reasonRequired: true,
        },
        payloadTemplate: {
          shipmentId: shipment.id,
          returnReason: shipment.status === 'POSTPONED' ? 'CUSTOMER_REFUSED' : 'RETURN_REQUESTED',
          notes: '',
          destinationMerchantBranchId: shipment.branch_id || null,
        },
      });
    }

    // 4. Construct multi-leg journey view
    const journey = allLegs.map((leg) => ({
      id: leg.id,
      sequence: leg.sequence,
      legType: leg.leg_type,
      status: leg.status,
      assignedDriverId: leg.assigned_driver_id,
      originFacilityId: leg.origin_facility_id,
      originMerchantBranchId: leg.origin_merchant_branch_id,
      destinationFacilityId: leg.destination_facility_id,
      destinationMerchantBranchId: leg.destination_merchant_branch_id,
      destinationIsCustomer: leg.destination_is_shipment_customer,
    }));

    // 5. Driver privacy filtering
    const sanitizedContext: Record<string, any> = {
      shipmentId: shipment.id,
      sequence: shipment.sequence,
      barcode: shipment.barcode,
      status: shipment.status,
      paymentType: shipment.payment_type,
      totalCollection: Number(shipment.declared_value || shipment.total_collection || 0),
      recipientName: shipment.recipient_name,
      recipientPhone: shipment.recipient_phone,
      recipientAddress: shipment.recipient_address,
      destinationCity: shipment.destination_city || shipment.city,
      currentCustody: currentCustody
        ? {
            currentHolderType: currentCustody.current_holder_type,
            currentFacilityId: currentCustody.current_facility_id,
            currentMerchantBranchId: currentCustody.current_merchant_branch_id,
            currentDriverId: currentCustody.current_driver_id,
            currentIsCustomer: currentCustody.current_is_customer,
            isTerminalCustomerCustody: currentCustody.is_terminal_customer_custody,
            lastHandoffAt: currentCustody.last_handoff_at,
          }
        : null,
      activeLeg: activeLeg
        ? {
            id: activeLeg.id,
            sequence: activeLeg.sequence,
            legType: activeLeg.leg_type,
            status: activeLeg.status,
            assignedDriverId: activeLeg.assigned_driver_id,
            originFacilityId: activeLeg.origin_facility_id,
            destinationFacilityId: activeLeg.destination_facility_id,
            destinationIsCustomer: activeLeg.destination_is_shipment_customer,
          }
        : null,
      journey,
    };

    // If staff/admin, add business metadata
    if (!isDriver) {
      sanitizedContext.merchantId = shipment.merchant_id;
      sanitizedContext.deliveryFee = shipment.delivery_fee;
      sanitizedContext.pricePlanId = shipment.price_plan_id;
      sanitizedContext.createdAt = shipment.created_at;
    }

    return {
      type: 'SHIPMENT',
      id: shipment.id,
      code: shipment.sequence,
      context: sanitizedContext,
      availableActions,
      notes: `شحنة رقم ${shipment.sequence}`,
    };
  }

  // --------------------------------------------------------------------------
  // ASSIGNMENT OPERATIONS (DOES NOT MUTATE CUSTODY)
  // --------------------------------------------------------------------------

  /**
   * Assigns a shipment leg to a driver with validation and assignment audit trail.
   * INVARIANT: Assignment does NOT change custody.
   */
  async assignLegToDriver(params: LegAssignmentParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const { legId, driverId, notes } = params;
    if (!legId || !driverId) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف المسار ومعرّف السائق مطلوبان', 400);
    }

    // 1. Verify driver exists and belongs to the same tenant
    const { data: driver, error: driverErr } = await this.supabase
      .from('users')
      .select('id, name, role, tenant_id, is_active')
      .eq('id', driverId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (driverErr || !driver) {
      throw new OperationalError('DRIVER_NOT_ASSIGNED', 'السائق غير موجود أو غير مسجل تحت نفس الشركة', 404);
    }
    if (driver.role !== 'DRIVER') {
      throw new OperationalError('DRIVER_NOT_ASSIGNED', 'المستخدم المحدد ليس في دور سائق توصيل', 400);
    }

    // 2. Fetch the leg and verify status
    const { data: leg, error: legErr } = await this.supabase
      .from('shipment_legs')
      .select('*')
      .eq('id', legId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (legErr || !leg) {
      throw new OperationalError('LEG_NOT_FOUND', 'مسار الشحنة غير موجود', 404);
    }

    if (['COMPLETED', 'CANCELLED'].includes(leg.status)) {
      throw new OperationalError('INVALID_LEG_STATE', `لا يمكن تعيين مسار بحالة مكتمل أو ملغي (${leg.status})`, 409);
    }

    // 3. Insert assignment history record
    const { error: assignHistErr } = await this.supabase.from('shipment_leg_assignments').insert([
      {
        tenant_id: ctx.tenantId,
        leg_id: legId,
        shipment_id: leg.shipment_id,
        driver_id: driverId,
        assigned_by_user_id: ctx.actorUserId,
        status: 'ACCEPTED',
        offered_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
      },
    ]);

    if (assignHistErr) {
      throw new OperationalError('DRIVER_NOT_ASSIGNED', `فشل في تسجيل عملية التعيين: ${assignHistErr.message}`, 500);
    }

    // 4. Update shipment_legs
    const { error: updateLegErr } = await this.supabase
      .from('shipment_legs')
      .update({
        assigned_driver_id: driverId,
        status: 'ASSIGNED',
        notes: notes || leg.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', legId)
      .eq('tenant_id', ctx.tenantId);

    if (updateLegErr) {
      throw new OperationalError('INVALID_LEG_STATE', `فشل في تحديث حالة المسار: ${updateLegErr.message}`, 500);
    }

    // Compatibility update: update legacy shipments.driver_id non-authoritatively
    await this.supabase
      .from('shipments')
      .update({ driver_id: driverId, updated_at: new Date().toISOString() })
      .eq('id', leg.shipment_id)
      .eq('tenant_id', ctx.tenantId);

    return {
      success: true,
      legId,
      shipmentId: leg.shipment_id,
      assignedDriverId: driverId,
      status: 'ASSIGNED',
      message: 'تم تعيين السائق للمسار بنجاح دون المساس بسلسلة العهدة الفيزيائية',
    };
  }

  // --------------------------------------------------------------------------
  // MANIFEST SERVICE CONTRACTS (DRAFT OPERATIONS)
  // --------------------------------------------------------------------------

  /**
   * Creates a new manifest container in DRAFT status
   */
  async createDraftManifest(params: CreateManifestParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const manifestNumber = `MNF-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const { data, error } = await this.supabase
      .from('operational_manifests')
      .insert([
        {
          tenant_id: ctx.tenantId,
          manifest_number: manifestNumber,
          manifest_type: params.manifestType,
          status: 'DRAFT',
          origin_facility_id: params.originFacilityId || null,
          destination_facility_id: params.destinationFacilityId || null,
          assigned_driver_id: params.assignedDriverId || null,
          created_by_user_id: ctx.actorUserId,
          notes: params.notes || null,
          total_items: 0,
          scanned_items_count: 0,
        },
      ])
      .select('*')
      .single();

    if (error) {
      throw new OperationalError('MANIFEST_STATE_INVALID', `فشل في إنشاء المنفست: ${error.message}`, 500);
    }

    return data;
  }

  /**
   * Adds an item to a draft manifest by scanning its barcode/sequence
   */
  async addManifestItemByScan(manifestId: string, scanValue: string, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    // 1. Fetch manifest and ensure it is in DRAFT status
    const { data: manifest, error: mErr } = await this.supabase
      .from('operational_manifests')
      .select('*')
      .eq('id', manifestId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (mErr || !manifest) {
      throw new OperationalError('MANIFEST_STATE_INVALID', 'المنفست غير موجود', 404);
    }
    if (manifest.status !== 'DRAFT') {
      throw new OperationalError('MANIFEST_STATE_INVALID', `لا يمكن إضافة طرود لمنفست بحالة (${manifest.status})`, 409);
    }

    // 2. Resolve the scan to find shipment and leg
    const scan = await this.resolveOperationalScan(scanValue, manifest.origin_facility_id, ctx);
    if (scan.entityType !== 'SHIPMENT' || !scan.shipmentId || !scan.currentLeg) {
      throw new OperationalError('INVALID_SCAN', 'الرمز الممسوح لا يطابق أي مسار شحنة نشط', 400);
    }

    // 3. Ensure not already added to this manifest
    const { data: existing } = await this.supabase
      .from('manifest_items')
      .select('id')
      .eq('manifest_id', manifestId)
      .eq('leg_id', scan.currentLeg.id)
      .maybeSingle();

    if (existing) {
      throw new OperationalError('DUPLICATE_OPERATION', 'هذه الشحنة مضافة بالفعل إلى هذا المنفست', 409);
    }

    // 4. Insert manifest item
    const { data: item, error: itemErr } = await this.supabase
      .from('manifest_items')
      .insert([
        {
          tenant_id: ctx.tenantId,
          manifest_id: manifestId,
          leg_id: scan.currentLeg.id,
          shipment_id: scan.shipmentId,
          scanned_at: new Date().toISOString(),
          scanned_by_user_id: ctx.actorUserId,
        },
      ])
      .select('*')
      .single();

    if (itemErr) {
      throw new OperationalError('MANIFEST_STATE_INVALID', `فشل في إضافة الشحنة للمنفست: ${itemErr.message}`, 500);
    }

    // 5. Update counts
    await this.supabase
      .from('operational_manifests')
      .update({
        total_items: (manifest.total_items || 0) + 1,
        scanned_items_count: (manifest.scanned_items_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', manifestId)
      .eq('tenant_id', ctx.tenantId);

    return {
      success: true,
      manifestItem: item,
      manifestNumber: manifest.manifest_number,
      totalItems: (manifest.total_items || 0) + 1,
    };
  }

  /**
   * Removes an item from a draft manifest
   */
  async removeDraftManifestItem(manifestId: string, itemId: string, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const { data: manifest } = await this.supabase
      .from('operational_manifests')
      .select('*')
      .eq('id', manifestId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (!manifest || manifest.status !== 'DRAFT') {
      throw new OperationalError('MANIFEST_STATE_INVALID', 'لا يمكن حذف عناصر إلا من منفست مسودة (DRAFT)', 409);
    }

    const { error } = await this.supabase
      .from('manifest_items')
      .delete()
      .eq('id', itemId)
      .eq('manifest_id', manifestId)
      .eq('tenant_id', ctx.tenantId);

    if (error) {
      throw new OperationalError('MANIFEST_STATE_INVALID', `فشل في إزالة العنصر: ${error.message}`, 500);
    }

    await this.supabase
      .from('operational_manifests')
      .update({
        total_items: Math.max(0, (manifest.total_items || 1) - 1),
        scanned_items_count: Math.max(0, (manifest.scanned_items_count || 1) - 1),
        updated_at: new Date().toISOString(),
      })
      .eq('id', manifestId)
      .eq('tenant_id', ctx.tenantId);

    return { success: true, removedItemId: itemId };
  }

  // --------------------------------------------------------------------------
  // TRANSACTIONAL MUTATION CONTRACTS (ATOMIC BOUNDARY CHECK)
  // --------------------------------------------------------------------------

  /**
   * Executes merchant pickup physical handoff: MERCHANT -> DRIVER
   * Validates all preconditions and executes through a PostgreSQL transaction RPC.
   * If atomic transaction RPC is not present, halts cleanly without faking atomicity.
   */
  async confirmMerchantPickup(params: ConfirmPickupParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    // Invariant Validations
    if (!params.shipmentId || !params.legId || !params.idempotencyKey) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف الشحنة والمسار ومفتاح منع التكرار إلزامية', 400);
    }

    // Verify atomic RPC availability in PostgreSQL
    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_confirm_merchant_pickup', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_shipment_id: params.shipmentId,
      p_leg_id: params.legId,
      p_merchant_branch_id: params.merchantBranchId || null,
      p_evidence_barcode: params.evidenceBarcode || null,
      p_evidence_otp: params.evidenceOtp || null,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey,
      p_latitude: params.latitude || null,
      p_longitude: params.longitude || null,
      p_evidence_type: params.evidenceType || 'BARCODE_SCAN',
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'CUSTODY_MISMATCH');
    }

    return rpcRes;
  }

  /**
   * Executes facility intake physical handoff: DRIVER -> FACILITY
   */
  async confirmFacilityIntake(params: ConfirmFacilityIntakeParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    await this.assertUserFacilityAccess(ctx.actorUserId, params.facilityId, ctx);

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_confirm_facility_intake', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_shipment_id: params.shipmentId,
      p_leg_id: params.legId,
      p_facility_id: params.facilityId,
      p_driver_id: params.driverId || null,
      p_evidence_barcode: params.evidenceBarcode || null,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey,
      p_latitude: params.latitude || null,
      p_longitude: params.longitude || null,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'CUSTODY_MISMATCH');
    }

    return rpcRes;
  }

  /**
   * Executes facility release physical handoff: FACILITY -> DRIVER
   */
  async confirmFacilityRelease(params: ConfirmFacilityReleaseParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    await this.assertUserFacilityAccess(ctx.actorUserId, params.facilityId, ctx);

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_confirm_facility_release', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_shipment_id: params.shipmentId,
      p_leg_id: params.legId,
      p_facility_id: params.facilityId,
      p_target_driver_id: params.targetDriverId,
      p_evidence_barcode: params.evidenceBarcode || null,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'CUSTODY_MISMATCH');
    }

    return rpcRes;
  }

  /**
   * Executes customer delivery physical handoff: DRIVER -> CUSTOMER
   * Atomic across: custody_events, shipment_current_custody, shipment_legs,
   * customer_payment_records, driver_cash_collections (if CASH), shipment_events.
   */
  async completeCustomerDelivery(params: CompleteDeliveryParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    if (params.paymentMethod === 'CLIQ' && !params.cliqReference) {
      throw new OperationalError('CLIQ_REFERENCE_REQUIRED', 'المرجع البنكي لـ CliQ إلزامي للدفع الإلكتروني', 400);
    }

    let legId = params.legId;
    if (!legId && params.shipmentId) {
      // Auto-resolve active LAST_MILE / DIRECT leg for this shipment
      const { data: activeLeg } = await this.supabase
        .from('shipment_legs')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .eq('shipment_id', params.shipmentId)
        .in('leg_type', ['LAST_MILE', 'DIRECT'])
        .in('status', ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'])
        .order('sequence', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (activeLeg) {
        legId = activeLeg.id;
      }
    }

    if (!legId) {
      throw new OperationalError('LEG_NOT_FOUND', 'لم يتم العثور على مرحلة توصيل نشطة للشحنة', 400);
    }

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_complete_customer_delivery', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_shipment_id: params.shipmentId,
      p_leg_id: legId,
      p_payment_method: params.paymentMethod,
      p_amount_paid: params.amountPaid,
      p_currency: params.currency || 'JOD',
      p_cliq_reference: params.cliqReference || null,
      p_wallet_reference: params.walletReference || null,
      p_evidence_otp: params.evidenceOtp || null,
      p_evidence_signature_url: params.evidenceSignatureUrl || null,
      p_evidence_photo_url: params.evidencePhotoUrl || null,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey,
      p_latitude: params.latitude || null,
      p_longitude: params.longitude || null,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'PAYMENT_MISMATCH');
    }

    return rpcRes;
  }

  /**
   * Records a delivery attempt failure.
   * INVARIANT: Delivery failure creates operational history but does NOT mark shipment RETURNED.
   */
  async recordDeliveryFailure(params: RecordDeliveryFailureParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    let legId = params.legId;
    if (!legId && params.shipmentId) {
      // Auto-resolve active LAST_MILE / DIRECT leg for this shipment
      const { data: activeLeg } = await this.supabase
        .from('shipment_legs')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .eq('shipment_id', params.shipmentId)
        .in('leg_type', ['LAST_MILE', 'DIRECT'])
        .in('status', ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'])
        .order('sequence', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (activeLeg) {
        legId = activeLeg.id;
      }
    }

    if (!legId) {
      throw new OperationalError('LEG_NOT_FOUND', 'لم يتم العثور على مرحلة توصيل نشطة لتسجيل التعذر', 400);
    }

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_record_delivery_failure', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_shipment_id: params.shipmentId,
      p_leg_id: legId,
      p_reason: params.reason,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'INVALID_LEG_STATE');
    }

    return rpcRes;
  }

  /**
   * Seals a manifest container and locks its contents
   */
  async sealManifest(manifestId: string, sealNumber: string, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_seal_manifest', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_manifest_id: manifestId,
      p_seal_number: sealNumber,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'MANIFEST_STATE_INVALID');
    }

    return rpcRes;
  }

  // --------------------------------------------------------------------------
  // PHASE 3C / STEP 6.2 — RETURN OPERATIONS (AUTHORITATIVE RPC WRAPPERS)
  // --------------------------------------------------------------------------

  /**
   * Initiates shipment return workflow atomically via public.execute_initiate_shipment_return
   * Creates a dedicated RETURN leg, calculates sequence, and records lifecycle events.
   */
  async initiateShipmentReturn(params: InitiateReturnParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    if (!params.shipmentId) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف الشحنة مطلوب لبدء مسار الإرجاع', 400);
    }
    if (!params.returnReason || !params.returnReason.trim()) {
      throw new OperationalError('RETURN_REASON_REQUIRED', 'سبب الإرجاع إلزامي لبدء مسار الإرجاع', 400);
    }

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_initiate_shipment_return', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_shipment_id: params.shipmentId,
      p_return_reason: params.returnReason.trim(),
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey || null,
      p_destination_facility_id: params.destinationFacilityId || null,
      p_destination_merchant_branch_id: params.destinationMerchantBranchId || null,
      p_origin_facility_id: params.originFacilityId || null,
      p_assigned_driver_id: params.assignedDriverId || null,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'INVALID_PAYLOAD');
    }

    return rpcRes;
  }

  /**
   * Confirms customer return pickup handoff (CUSTOMER -> DRIVER) atomically via public.execute_confirm_customer_return_pickup
   */
  async confirmCustomerReturnPickup(params: ConfirmCustomerReturnPickupParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    if (!params.shipmentId || !params.legId) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف الشحنة ومعرّف مسار الإرجاع مطلوبان', 400);
    }

    const effectiveDriverId = params.driverId || (ctx.role === 'DRIVER' ? ctx.actorUserId : null);

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_confirm_customer_return_pickup', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_shipment_id: params.shipmentId,
      p_leg_id: params.legId,
      p_driver_id: effectiveDriverId,
      p_evidence_barcode: params.evidenceBarcode || null,
      p_evidence_otp: params.evidenceOtp || null,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey || null,
      p_latitude: params.latitude || null,
      p_longitude: params.longitude || null,
      p_evidence_type: params.evidenceType || 'BARCODE',
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'CUSTODY_MISMATCH');
    }

    return rpcRes;
  }

  /**
   * Confirms merchant receipt of returned shipment (DRIVER/FACILITY -> MERCHANT BRANCH) atomically via public.execute_confirm_merchant_return_receipt
   * Terminal return transaction: completes RETURN leg and marks shipment status as RETURNED.
   */
  async confirmMerchantReturnReceipt(params: ConfirmMerchantReturnReceiptParams, ctx: AuthenticatedOperationContext) {
    this.validateContext(ctx);

    if (!params.shipmentId || !params.legId) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف الشحنة ومعرّف مسار الإرجاع مطلوبان', 400);
    }

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_confirm_merchant_return_receipt', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_shipment_id: params.shipmentId,
      p_leg_id: params.legId,
      p_merchant_branch_id: params.merchantBranchId || null,
      p_evidence_barcode: params.evidenceBarcode || null,
      p_evidence_signature_url: params.evidenceSignatureUrl || null,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey || null,
      p_evidence_type: params.evidenceType || 'SIGNATURE',
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'CUSTODY_MISMATCH');
    }

    return rpcRes;
  }

  // --------------------------------------------------------------------------
  // PRIVACY SANITIZATION HELPERS
  // --------------------------------------------------------------------------

  /**
   * Sanitizes shipment leg object for driver exposure.
   * Strips merchant tariffs, company margins, and other drivers' earnings.
   */
  public sanitizeDriverOperationalView(leg: any) {
    if (!leg) return null;
    return {
      id: leg.id,
      shipmentId: leg.shipment_id,
      sequence: leg.sequence,
      legType: leg.leg_type,
      status: leg.status,
      assignedDriverId: leg.assigned_driver_id,
      originFacilityId: leg.origin_facility_id,
      originMerchantBranchId: leg.origin_merchant_branch_id,
      originIsCustomer: leg.origin_is_shipment_customer,
      destinationFacilityId: leg.destination_facility_id,
      destinationMerchantBranchId: leg.destination_merchant_branch_id,
      destinationIsCustomer: leg.destination_is_shipment_customer,
      plannedStartAt: leg.planned_start_at,
      plannedEndAt: leg.planned_end_at,
      actualStartAt: leg.actual_start_at,
      actualEndAt: leg.actual_end_at,
      notes: leg.notes,
      createdAt: leg.created_at,
      // Strictly excluded:
      // merchant_tariff, company_revenue, company_margin, internal_costs
    };
  }

  /**
   * Verifies that the actor has explicit access to the specified facility
   */
  private async assertUserFacilityAccess(userId: string, facilityId: string, ctx: AuthenticatedOperationContext) {
    if (ctx.isSuperAdmin || ['SUPER_ADMIN', 'ADMIN'].includes(ctx.role)) {
      return; // Admins have organization-wide facility access
    }

    const { data: access, error } = await this.supabase
      .from('user_facility_access')
      .select('id, can_dispatch, can_receive')
      .eq('user_id', userId)
      .eq('facility_id', facilityId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (error || !access) {
      throw new OperationalError('FACILITY_ACCESS_DENIED', 'ليس لديك صلاحية وصول إلى هذه المنشأة اللوجستية', 403);
    }
  }
}

import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { Order, OrderStatus, PaymentType, User } from '../types/logistics.ts';
import {
  validateAndNormalizeJordanPhone,
  validateAndNormalizeSecondaryJordanPhone,
} from '../utils/jordanPhone.ts';

export class OrderPersistenceError extends Error {
  public code: string;
  public statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'OrderPersistenceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface CanonicalOrderPayload {
  merchantId: string;
  merchantBranchId?: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientPhoneAlt?: string | null;
  governorate: string;
  area: string;
  subArea?: string | null;
  streetAddress: string;
  locationCoordinates?: string | null;
  packageType: string;
  packageWeightKg?: number;
  piecesCount: number;
  paymentType: PaymentType;
  paymentMethod?: string;
  cliqReference?: string | null;
  totalCollectionInput?: number;
  merchantCollectionInput?: number;
  scheduledDate?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
}

export function computeCanonicalPayloadHash(payload: CanonicalOrderPayload): string {
  // Deterministic serialization of client intent fields with canonical Jordan phone normalization
  const phoneValidation = validateAndNormalizeJordanPhone(payload.recipientPhone);
  const canonicalPhone = phoneValidation.isValid && phoneValidation.canonicalPhone
    ? phoneValidation.canonicalPhone
    : (payload.recipientPhone || '').replace(/[\s-]/g, '');

  let canonicalPhoneAlt: string | null = null;
  if (payload.recipientPhoneAlt && payload.recipientPhoneAlt.trim() !== '') {
    const altValidation = validateAndNormalizeSecondaryJordanPhone(payload.recipientPhoneAlt);
    canonicalPhoneAlt = altValidation.isValid ? altValidation.canonicalPhone : (payload.recipientPhoneAlt || '').replace(/[\s-]/g, '');
  }

  const normalized = {
    area: (payload.area || '').trim().toLowerCase(),
    cliq_reference: (payload.cliqReference || '').trim() || null,
    governorate: (payload.governorate || '').trim().toLowerCase(),
    location_coordinates: (payload.locationCoordinates || '').trim() || null,
    merchant_branch_id: payload.merchantBranchId || null,
    merchant_collection_input: payload.merchantCollectionInput !== undefined && payload.merchantCollectionInput !== null
      ? Number(payload.merchantCollectionInput).toFixed(3)
      : null,
    merchant_id: payload.merchantId,
    notes: (payload.notes || '').trim() || null,
    package_type: (payload.packageType || '').trim(),
    package_weight_kg: payload.packageWeightKg ? Number(payload.packageWeightKg).toFixed(2) : '1.00',
    payment_method: (payload.paymentMethod || 'CASH').toUpperCase(),
    payment_type: payload.paymentType,
    pieces_count: payload.piecesCount || 1,
    recipient_name: (payload.recipientName || '').trim().toLowerCase(),
    recipient_phone: canonicalPhone,
    recipient_phone_alt: canonicalPhoneAlt,
    reference_number: (payload.referenceNumber || '').trim() || null,
    scheduled_date: payload.scheduledDate || null,
    street_address: (payload.streetAddress || '').trim().toLowerCase(),
    sub_area: (payload.subArea || '').trim().toLowerCase() || null,
    total_collection_input: payload.totalCollectionInput !== undefined && payload.totalCollectionInput !== null
      ? Number(payload.totalCollectionInput).toFixed(3)
      : '0.000',
  };

  const sortedJson = JSON.stringify(normalized, Object.keys(normalized).sort());
  return crypto.createHash('sha256').update(sortedJson).digest('hex');
}

/**
 * Maps Supabase public.shipments database row to legacy/frontend Order interface.
 * Implements strict display compatibility without corrupting physical custody states.
 */
export function mapShipmentRowToOrder(row: any, users: User[] = []): Order {
  if (!row) throw new Error('Cannot map empty shipment row');

  // Status mapping:
  // CREATED -> PENDING
  // RESCHEDULED -> POSTPONED
  // Other statuses map 1:1
  let appStatus: OrderStatus = 'PENDING';
  if (row.status === 'CREATED') {
    appStatus = 'PENDING';
  } else if (row.status === 'RESCHEDULED') {
    appStatus = 'POSTPONED';
  } else if (
    ['PENDING', 'PICKING', 'RECEIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'POSTPONED', 'CANCELLED', 'DELIVERED', 'RETURNED'].includes(row.status)
  ) {
    appStatus = row.status as OrderStatus;
  }

  // Payment type mapping:
  // If payment_method is CLIQ, return CLIQ for frontend
  let appPaymentType: PaymentType = 'COD';
  if (row.payment_method === 'CLIQ' || row.payment_type === 'CLIQ') {
    appPaymentType = 'CLIQ';
  } else if (row.payment_type === 'PREPAID') {
    appPaymentType = 'PREPAID';
  } else {
    appPaymentType = 'COD';
  }

  const merchant = users.find((u) => u.id === row.merchant_id);
  const driver = row.driver_id ? users.find((u) => u.id === row.driver_id) || null : null;

  return {
    id: String(row.id),
    sequence: row.sequence || '',
    referenceNumber: row.reference_number || undefined,
    tenantId: row.tenant_id,
    status: appStatus,
    paymentType: appPaymentType,
    merchantId: row.merchant_id,
    merchant,
    branchId: row.branch_id || undefined,
    driverId: row.driver_id || null,
    driver,
    recipientName: row.recipient_name || '',
    recipientPhone: row.recipient_phone || '',
    recipientPhoneAlt: row.recipient_phone2 || undefined,
    governorate: row.governorate || 'عمان',
    area: row.area || 'عمان',
    subArea: row.sub_area || undefined,
    fullAddress: row.address || `${row.governorate || 'عمان'} - ${row.area || 'عمان'}`,
    merchantCollection: Number(row.merchant_collection || 0),
    deliveryFee: Number(row.delivery_fee || 0),
    driverFee: row.driver_fee !== null && row.driver_fee !== undefined ? Number(row.driver_fee) : undefined,
    returnFee: row.return_fee !== null && row.return_fee !== undefined ? Number(row.return_fee) : undefined,
    totalCollection: Number(row.cod_amount || row.total_collection || 0),
    isSettledWithMerchant: row.settlement_status === 'SETTLED',
    isSettledWithDriver: row.driver_settlement_id !== null && row.driver_settlement_id !== undefined,
    settlementStatus: row.settlement_status === 'SETTLED' ? 'SETTLED' : row.settlement_status === 'CANCELLED' ? 'CANCELLED' : 'PENDING',
    packageType: row.package_details || 'طرد عادي',
    packageWeightKg: row.weight ? Number(row.weight) : 1.0,
    piecesCount: row.pieces ? Number(row.pieces) : 1,
    deliveryAttempts: row.delivery_attempts || 0,
    notes: row.notes || undefined,
    deliveryOtp: undefined,
    otpVerified: Boolean(row.pod_signature_url || row.pod_image_url || row.delivered_at),
    recipientSignature: row.pod_signature_url || undefined,
    deliveryPhoto: row.pod_image_url || undefined,
    deliveredAt: row.delivered_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export class OrderPersistenceService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Authoritative Idempotent Order Creation via Postgres RPC.
   * Atomically writes to public.shipments and public.shipment_status_history.
   * Fails closed on any error.
   */
  async createOrderIdempotent(params: {
    tenantId: string;
    merchantId: string;
    branchId?: string | null;
    requestType?: string;
    idempotencyKey?: string | null;
    canonicalPayload: CanonicalOrderPayload;
    deliveryFee: number;
    merchantCollection: number;
    totalCollection: number;
    driverId?: string | null;
    driverFee?: number;
    actorId?: string | null;
    actorName?: string | null;
    actorRole?: string | null;
  }): Promise<{ shipment: any; isReplay: boolean }> {
    // Validate & normalize canonical Jordan phone numbers
    const phoneValidation = validateAndNormalizeJordanPhone(params.canonicalPayload.recipientPhone);
    if (!phoneValidation.isValid || !phoneValidation.canonicalPhone) {
      throw new OrderPersistenceError(
        'INVALID_RECIPIENT_PHONE',
        phoneValidation.error || 'رقم الهاتف يجب أن يكون رقمًا أردنيًا صحيحًا من 10 أرقام مثل 0791234567، أو بصيغة +962 بدون الصفر الأول.',
        400
      );
    }

    let canonicalPhoneAlt: string | null = null;
    if (params.canonicalPayload.recipientPhoneAlt && params.canonicalPayload.recipientPhoneAlt.trim() !== '') {
      const altValidation = validateAndNormalizeSecondaryJordanPhone(params.canonicalPayload.recipientPhoneAlt);
      if (!altValidation.isValid) {
        throw new OrderPersistenceError(
          'INVALID_SECONDARY_PHONE',
          altValidation.error || 'رقم الهاتف الإضافي يجب أن يكون رقمًا أردنيًا صحيحًا من 10 أرقام مثل 0791234567، أو بصيغة +962 بدون الصفر الأول.',
          400
        );
      }
      canonicalPhoneAlt = altValidation.canonicalPhone;
    }

    const normalizedPayload: CanonicalOrderPayload = {
      ...params.canonicalPayload,
      recipientPhone: phoneValidation.canonicalPhone,
      recipientPhoneAlt: canonicalPhoneAlt,
    };

    const payloadHash = computeCanonicalPayloadHash(normalizedPayload);
    const requestType = params.requestType || 'ORDER_CREATE';

    // Map payment type & payment method
    let paymentType = 'COD';
    let paymentMethod = 'CASH';
    if (normalizedPayload.paymentType === 'CLIQ') {
      paymentType = 'PREPAID';
      paymentMethod = 'CLIQ';
    } else if (normalizedPayload.paymentType === 'PREPAID') {
      paymentType = 'PREPAID';
      paymentMethod = normalizedPayload.paymentMethod || 'BANK_TRANSFER';
    } else {
      paymentType = 'COD';
      paymentMethod = 'CASH';
    }

    // Call canonical atomic creation RPC
    const { data, error } = await this.supabase.rpc('create_order_idempotent', {
      p_tenant_id: params.tenantId,
      p_merchant_id: params.merchantId,
      p_branch_id: params.branchId || null,
      p_request_type: requestType,
      p_idempotency_key: params.idempotencyKey || null,
      p_payload_hash: payloadHash,
      p_recipient_name: normalizedPayload.recipientName,
      p_recipient_phone: normalizedPayload.recipientPhone,
      p_recipient_phone2: normalizedPayload.recipientPhoneAlt || null,
      p_governorate: normalizedPayload.governorate,
      p_area: normalizedPayload.area,
      p_sub_area: normalizedPayload.subArea || null,
      p_address: normalizedPayload.streetAddress,
      p_package_details: normalizedPayload.packageType,
      p_notes: normalizedPayload.notes || null,
      p_payment_type: paymentType,
      p_payment_method: paymentMethod,
      p_cliq_reference: normalizedPayload.cliqReference || null,
      p_weight: normalizedPayload.packageWeightKg || 1.00,
      p_pieces: normalizedPayload.piecesCount || 1,
      p_reference_number: normalizedPayload.referenceNumber || null,
      p_delivery_fee: params.deliveryFee,
      p_merchant_collection: params.merchantCollection,
      p_total_collection: params.totalCollection,
      p_actor_id: params.actorId || null,
      p_actor_name: params.actorName || null,
      p_actor_role: params.actorRole || null,
    });

    if (error) {
      if (error.message && error.message.includes('IDEMPOTENCY_REPLAY_MISMATCH')) {
        throw new OrderPersistenceError(
          'IDEMPOTENCY_PAYLOAD_MISMATCH',
          'مفتاح الطلب (Idempotency-Key) مستخدم مسبقاً مع بيانات شحنة مختلفة',
          409
        );
      }
      throw new OrderPersistenceError('DB_ERROR', `فشل تسجيل الشحنة في قاعدة البيانات: ${error.message}`, 500);
    }

    if (!data || !data.success) {
      throw new OrderPersistenceError('DB_ERROR', 'فشل تسجيل الشحنة في قاعدة البيانات (استجابة فارغة)', 500);
    }

    const isReplay = Boolean(data.is_replay);
    return { shipment: data.shipment, isReplay };
  }

  /**
   * Fetch paginated shipments directly from public.shipments with strict tenant/merchant/driver scope.
   */
  async getShipments(params: {
    tenantId?: string;
    merchantId?: string;
    driverId?: string;
    branchId?: string;
    status?: string;
    governorate?: string;
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<{
    shipments: any[];
    total: number;
    stats: {
      total: number;
      pending: number;
      picking: number;
      out_for_delivery: number;
      delivered: number;
      cancelled: number;
      postponed: number;
      totalCOD: number;
      totalDeliveryFees: number;
    };
  }> {
    // 1. Base scoped query for workspace metrics
    let statsQuery = this.supabase.from('shipments').select('status, cod_amount, delivery_fee');
    if (params.tenantId) {
      statsQuery = statsQuery.eq('tenant_id', params.tenantId);
    }
    if (params.merchantId && params.merchantId !== 'ALL') {
      statsQuery = statsQuery.eq('merchant_id', params.merchantId);
    }
    if (params.branchId && params.branchId !== 'ALL') {
      statsQuery = statsQuery.eq('branch_id', params.branchId);
    }
    if (params.driverId) {
      if (params.driverId === 'UNASSIGNED') {
        statsQuery = statsQuery.is('driver_id', null);
      } else if (params.driverId !== 'ALL') {
        statsQuery = statsQuery.eq('driver_id', params.driverId);
      }
    }

    const { data: statsRows, error: statsErr } = await statsQuery;
    if (statsErr) {
      throw new OrderPersistenceError('DB_ERROR', `فشل استرجاع إحصائيات الشحنات: ${statsErr.message}`, 500);
    }

    const rows = statsRows || [];
    const stats = {
      total: rows.length,
      pending: rows.filter((r) => r.status === 'CREATED' || r.status === 'PENDING').length,
      picking: rows.filter((r) => r.status === 'PICKING' || r.status === 'RECEIVED_AT_HUB').length,
      out_for_delivery: rows.filter((r) => r.status === 'OUT_FOR_DELIVERY').length,
      delivered: rows.filter((r) => r.status === 'DELIVERED').length,
      cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
      postponed: rows.filter((r) => r.status === 'RESCHEDULED' || r.status === 'POSTPONED').length,
      totalCOD: rows.reduce((sum, r) => sum + Number(r.cod_amount || 0), 0),
      totalDeliveryFees: rows.reduce((sum, r) => sum + Number(r.delivery_fee || 0), 0),
    };

    // 2. Filtered and paginated list query
    let listQuery = this.supabase.from('shipments').select('*', { count: 'exact' });

    if (params.tenantId) {
      listQuery = listQuery.eq('tenant_id', params.tenantId);
    }
    if (params.merchantId && params.merchantId !== 'ALL') {
      listQuery = listQuery.eq('merchant_id', params.merchantId);
    }
    if (params.branchId && params.branchId !== 'ALL') {
      listQuery = listQuery.eq('branch_id', params.branchId);
    }
    if (params.driverId) {
      if (params.driverId === 'UNASSIGNED') {
        listQuery = listQuery.is('driver_id', null);
      } else if (params.driverId !== 'ALL') {
        listQuery = listQuery.eq('driver_id', params.driverId);
      }
    }
    if (params.status && params.status !== 'ALL') {
      if (params.status === 'PENDING') {
        listQuery = listQuery.in('status', ['CREATED', 'PENDING']);
      } else if (params.status === 'POSTPONED') {
        listQuery = listQuery.in('status', ['RESCHEDULED', 'POSTPONED']);
      } else {
        listQuery = listQuery.eq('status', params.status);
      }
    }
    if (params.governorate && params.governorate !== 'ALL') {
      listQuery = listQuery.eq('governorate', params.governorate);
    }
    if (params.search) {
      const s = params.search.trim();
      listQuery = listQuery.or(`sequence.ilike.%${s}%,recipient_phone.ilike.%${s}%,recipient_name.ilike.%${s}%,area.ilike.%${s}%`);
    }

    // Sort column mapping
    const sortFieldMap: Record<string, string> = {
      createdAt: 'created_at',
      totalCollection: 'cod_amount',
      deliveryFee: 'delivery_fee',
      recipientName: 'recipient_name',
      status: 'status',
      sequence: 'sequence',
    };
    const sortColumn = (params.sortBy && sortFieldMap[params.sortBy]) || 'created_at';
    const isAsc = params.sortDir === 'asc';

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 10);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    listQuery = listQuery.order(sortColumn, { ascending: isAsc }).range(from, to);

    const { data: listRows, count, error: listErr } = await listQuery;
    if (listErr) {
      throw new OrderPersistenceError('DB_ERROR', `فشل استرجاع قائمة الشحنات: ${listErr.message}`, 500);
    }

    return {
      shipments: listRows || [],
      total: count || 0,
      stats,
    };
  }

  /**
   * Fetch single shipment by ID from public.shipments.
   */
  async getShipmentById(id: string, tenantId?: string): Promise<any | null> {
    let query = this.supabase.from('shipments').select('*').eq('id', id);
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new OrderPersistenceError('DB_ERROR', `فشل استرجاع بيانات الشحنة: ${error.message}`, 500);
    }

    return data || null;
  }

  /**
   * Cold-start safe public tracking lookup without leaking internal tenant/finance fields.
   */
  async getShipmentByTracking(queryStr: string): Promise<any | null> {
    const q = queryStr.trim();
    if (!q) return null;

    let query = this.supabase.from('shipments').select('*');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    if (isUuid) {
      query = query.or(`id.eq.${q},sequence.ilike.${q},barcode.ilike.${q},reference_number.ilike.${q},recipient_phone.ilike.${q}`);
    } else {
      query = query.or(`sequence.ilike.${q},barcode.ilike.${q},reference_number.ilike.${q},recipient_phone.ilike.${q}`);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) {
      throw new OrderPersistenceError('DB_ERROR', `فشل الاستعلام عن الشحنة: ${error.message}`, 500);
    }
    return data || null;
  }

  /**
   * Database-authoritative operational summary report.
   */
  async getOperationalSummary(tenantId?: string): Promise<{
    totalOrders: number;
    deliveredOrders: number;
    outForDeliveryOrders: number;
    inHubOrders: number;
    returnedOrders: number;
    successRate: string;
    byGovernorate: { name: string; count: number }[];
  }> {
    let query = this.supabase.from('shipments').select('status, governorate');
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query;
    if (error) {
      throw new OrderPersistenceError('DB_ERROR', `فشل استرجاع التقرير التشغيلي: ${error.message}`, 500);
    }

    const rows = data || [];
    const total = rows.length;
    const delivered = rows.filter((r) => r.status === 'DELIVERED').length;
    const outForDelivery = rows.filter((r) => r.status === 'OUT_FOR_DELIVERY').length;
    const inHub = rows.filter((r) => r.status === 'RECEIVED_AT_HUB' || r.status === 'PICKING').length;
    const returned = rows.filter((r) => r.status === 'RETURNED' || r.status === 'CANCELLED').length;
    const successRate = total > 0 ? `${((delivered / total) * 100).toFixed(1)}%` : '0%';

    const govMap: Record<string, number> = {};
    for (const r of rows) {
      const g = r.governorate || 'عمان';
      govMap[g] = (govMap[g] || 0) + 1;
    }
    const byGovernorate = Object.entries(govMap).map(([name, count]) => ({ name, count }));

    return {
      totalOrders: total,
      deliveredOrders: delivered,
      outForDeliveryOrders: outForDelivery,
      inHubOrders: inHub,
      returnedOrders: returned,
      successRate,
      byGovernorate,
    };
  }

  /**
   * Authoritative count of orders created this month for subscription limiting.
   */
  async getMonthlyOrdersCount(tenantId: string, monthStart: Date): Promise<number> {
    const { count, error } = await this.supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .or(`tenant_id.eq.${tenantId},merchant_id.eq.${tenantId}`)
      .gte('created_at', monthStart.toISOString());
    if (error) return 0;
    return count || 0;
  }

  /**
   * Fetch scoped shipments for settlement calculations.
   */
  async getSettlementShipments(params: {
    tenantId?: string;
    merchantId?: string;
    driverId?: string;
  }): Promise<any[]> {
    let query = this.supabase.from('shipments').select('*');
    if (params.tenantId) query = query.eq('tenant_id', params.tenantId);
    if (params.merchantId) query = query.eq('merchant_id', params.merchantId);
    if (params.driverId) query = query.eq('driver_id', params.driverId);
    const { data, error } = await query;
    if (error) {
      throw new OrderPersistenceError('DB_ERROR', `فشل استرجاع بيانات التسوية: ${error.message}`, 500);
    }
    return data || [];
  }

  /**
   * Settle delivered shipments for a merchant.
   */
  async settleMerchantShipments(params: {
    tenantId?: string;
    merchantId: string;
  }): Promise<{ settledCount: number; settledAmount: number; shipmentIds: string[] }> {
    let query = this.supabase
      .from('shipments')
      .select('id, merchant_collection, cod_amount, delivery_fee')
      .eq('merchant_id', params.merchantId)
      .eq('status', 'DELIVERED')
      .neq('settlement_status', 'SETTLED');
    if (params.tenantId) {
      query = query.eq('tenant_id', params.tenantId);
    }
    const { data, error } = await query;
    if (error) throw new OrderPersistenceError('DB_ERROR', error.message, 500);

    const rows = data || [];
    const ids = rows.map((r: any) => r.id);
    const settledAmount = rows.reduce((sum: number, r: any) => sum + Number(r.merchant_collection || 0), 0);

    if (ids.length > 0) {
      const { error: updErr } = await this.supabase
        .from('shipments')
        .update({ settlement_status: 'SETTLED', updated_at: new Date().toISOString() })
        .in('id', ids);
      if (updErr) throw new OrderPersistenceError('DB_ERROR', updErr.message, 500);
    }

    return { settledCount: ids.length, settledAmount, shipmentIds: ids };
  }

  /**
   * Settle delivered cash collections for a driver.
   */
  async settleDriverShipments(params: {
    tenantId?: string;
    driverId: string;
  }): Promise<{ settledCount: number; cashCollected: number; shipmentIds: string[] }> {
    let query = this.supabase
      .from('shipments')
      .select('id, cod_amount')
      .eq('driver_id', params.driverId)
      .eq('status', 'DELIVERED')
      .is('driver_settlement_id', null);
    if (params.tenantId) {
      query = query.eq('tenant_id', params.tenantId);
    }
    const { data, error } = await query;
    if (error) throw new OrderPersistenceError('DB_ERROR', error.message, 500);

    const rows = data || [];
    const ids = rows.map((r: any) => r.id);
    const cashCollected = rows.reduce((sum: number, r: any) => sum + Number(r.cod_amount || 0), 0);

    if (ids.length > 0) {
      const syntheticSettlementId = `drv-settle-${Date.now()}`;
      const { error: updErr } = await this.supabase
        .from('shipments')
        .update({ driver_settlement_id: syntheticSettlementId, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (updErr) throw new OrderPersistenceError('DB_ERROR', updErr.message, 500);
    }

    return { settledCount: ids.length, cashCollected, shipmentIds: ids };
  }
}

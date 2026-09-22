import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export interface MerchantProductDTO {
  id: string;
  merchantId: string;
  name: string;
  sku: string;
  barcode?: string;
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

export interface StockMovementDTO {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'IN_PURCHASE' | 'OUT_SALE' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'RETURN_IN' | 'DAMAGE_OUT';
  quantityChange: number;
  previousStock: number;
  newStock: number;
  referenceNumber: string;
  notes?: string;
  timestamp: string;
  performedBy: string;
}

export interface StockTransferDTO {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  status: 'DRAFT' | 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface WarehouseStatsDTO {
  totalSkus: number;
  totalQuantity: number;
  totalCostValue: number;
  totalRetailValue: number;
  potentialGrossProfit: number;
  marginPercent: number;
  lowStockCount: number;
  lowStockProducts: MerchantProductDTO[];
}

export class InventoryServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'InventoryServiceError';
  }
}

function isValidUuid(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function ensureUuid(id: string): string {
  if (isValidUuid(id)) return id;
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
}

export class MerchantInventoryService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Fetch authoritative products for a merchant from Supabase Postgres
   */
  async getProducts(merchantId: string, tenantId: string = '00000000-0000-0000-0000-000000000001'): Promise<MerchantProductDTO[]> {
    const safeMerchantId = ensureUuid(merchantId);
    const safeTenantId = ensureUuid(tenantId);

    const { data: rawProducts, error: pErr } = await this.supabase
      .from('products')
      .select('*')
      .eq('merchant_id', safeMerchantId)
      .eq('tenant_id', safeTenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (pErr) {
      throw new InventoryServiceError('DB_ERROR', `Failed to query products: ${pErr.message}`, 500);
    }

    if (!rawProducts || rawProducts.length === 0) {
      return [];
    }

    const productIds = rawProducts.map((p) => p.id);

    // Fetch branch inventory stock balances to calculate branch stock aggregate
    const { data: rawInventory } = await this.supabase
      .from('branch_inventory')
      .select('product_id, quantity')
      .in('product_id', productIds)
      .eq('tenant_id', safeTenantId);

    const stockMap = new Map<string, number>();
    if (rawInventory) {
      for (const inv of rawInventory) {
        const current = stockMap.get(inv.product_id) || 0;
        stockMap.set(inv.product_id, current + (Number(inv.quantity) || 0));
      }
    }

    return rawProducts.map((p) => {
      const stockQty = stockMap.has(p.id) ? stockMap.get(p.id)! : 0;
      return {
        id: p.id,
        merchantId: p.merchant_id,
        name: p.name || 'منتج',
        sku: p.sku || '',
        barcode: p.barcode || undefined,
        category: p.category || 'عام',
        costPrice: Number(p.cost_price) || 0,
        sellingPrice: Number(p.selling_price) || 0,
        stockQuantity: stockQty,
        minStockAlert: p.min_stock_alert !== null && p.min_stock_alert !== undefined ? Number(p.min_stock_alert) : 5,
        unit: p.unit || 'قطعة',
        locationRack: p.location_rack || undefined,
        notes: p.notes || undefined,
        updatedAt: p.updated_at || p.created_at || new Date().toISOString(),
      };
    });
  }

  /**
   * Create product in Supabase Postgres and trigger atomic initial stock adjustment if initial stock > 0
   */
  async createProduct(
    merchantId: string,
    tenantId: string,
    payload: {
      id?: string;
      name: string;
      sku?: string;
      barcode?: string;
      category?: string;
      costPrice?: number;
      sellingPrice?: number;
      stockQuantity?: number;
      minStockAlert?: number;
      unit?: string;
      locationRack?: string;
      notes?: string;
      branchId?: string;
    },
    performedByUserId?: string
  ): Promise<MerchantProductDTO> {
    const safeMerchantId = ensureUuid(merchantId);
    const safeTenantId = ensureUuid(tenantId);
    const productId = payload.id && isValidUuid(payload.id) ? payload.id : crypto.randomUUID();

    if (!payload.name || payload.name.trim() === '') {
      throw new InventoryServiceError('INVALID_NAME', 'اسم المنتج مطلوب', 400);
    }

    const sku = payload.sku && payload.sku.trim() !== '' 
      ? payload.sku.trim() 
      : `SKU-${Math.floor(100000 + Math.random() * 900000)}`;

    const category = payload.category && payload.category.trim() !== '' ? payload.category.trim() : 'عام';
    const costPrice = Number(payload.costPrice) >= 0 ? Number(payload.costPrice) : 0;
    const sellingPrice = Number(payload.sellingPrice) >= 0 ? Number(payload.sellingPrice) : 0;
    const initialStock = Number(payload.stockQuantity) >= 0 ? Math.floor(Number(payload.stockQuantity)) : 0;
    const minStockAlert = payload.minStockAlert !== undefined ? Math.floor(Number(payload.minStockAlert)) : 5;
    const unit = payload.unit && payload.unit.trim() !== '' ? payload.unit.trim() : 'قطعة';

    // Insert Product Row into Supabase
    const { data: newProd, error: insertErr } = await this.supabase
      .from('products')
      .insert({
        id: productId,
        tenant_id: safeTenantId,
        merchant_id: safeMerchantId,
        sku,
        barcode: payload.barcode || null,
        name: payload.name.trim(),
        description: payload.notes || null,
        category,
        cost_price: costPrice,
        selling_price: sellingPrice,
        tax_rate: 0,
        unit,
        min_stock_alert: minStockAlert,
        location_rack: payload.locationRack || null,
        notes: payload.notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        throw new InventoryServiceError('DUPLICATE_SKU', 'رمز المنتج (SKU) مستخدم بالفعل لهذا التاجر', 400);
      }
      throw new InventoryServiceError('DB_ERROR', `فشل إنشاء المنتج: ${insertErr.message}`, 500);
    }

    // Atomic Initial Stock Adjustment if initial stock specified
    if (initialStock > 0) {
      await this.adjustStock(safeMerchantId, safeTenantId, {
        productId,
        quantityChange: initialStock,
        branchId: payload.branchId,
        type: 'IN_PURCHASE',
        referenceNumber: 'INIT-STOCK',
        notes: 'رصيد افتتاحي عند إضافة المنتج',
        performedByUserId,
      });
    }

    return {
      id: newProd.id,
      merchantId: newProd.merchant_id,
      name: newProd.name,
      sku: newProd.sku,
      barcode: newProd.barcode || undefined,
      category: newProd.category,
      costPrice: Number(newProd.cost_price),
      sellingPrice: Number(newProd.selling_price),
      stockQuantity: initialStock,
      minStockAlert: Number(newProd.min_stock_alert),
      unit: newProd.unit,
      locationRack: newProd.location_rack || undefined,
      notes: newProd.notes || undefined,
      updatedAt: newProd.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Update Product metadata in Supabase
   */
  async updateProduct(
    merchantId: string,
    tenantId: string,
    productId: string,
    payload: Partial<MerchantProductDTO>
  ): Promise<MerchantProductDTO> {
    const safeMerchantId = ensureUuid(merchantId);
    const safeTenantId = ensureUuid(tenantId);
    const safeProductId = ensureUuid(productId);

    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.name !== undefined) updateFields.name = payload.name.trim();
    if (payload.sku !== undefined) updateFields.sku = payload.sku.trim();
    if (payload.barcode !== undefined) updateFields.barcode = payload.barcode || null;
    if (payload.category !== undefined) updateFields.category = payload.category.trim();
    if (payload.costPrice !== undefined) updateFields.cost_price = Number(payload.costPrice);
    if (payload.sellingPrice !== undefined) updateFields.selling_price = Number(payload.sellingPrice);
    if (payload.minStockAlert !== undefined) updateFields.min_stock_alert = Math.floor(Number(payload.minStockAlert));
    if (payload.unit !== undefined) updateFields.unit = payload.unit.trim();
    if (payload.locationRack !== undefined) updateFields.location_rack = payload.locationRack || null;
    if (payload.notes !== undefined) updateFields.notes = payload.notes || null;

    const { data: updated, error } = await this.supabase
      .from('products')
      .update(updateFields)
      .eq('id', safeProductId)
      .eq('merchant_id', safeMerchantId)
      .eq('tenant_id', safeTenantId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new InventoryServiceError('DUPLICATE_SKU', 'رمز المنتج (SKU) مستخدم بالفعل', 400);
      }
      throw new InventoryServiceError('DB_ERROR', `فشل تحديث المنتج: ${error.message}`, 500);
    }

    if (!updated) {
      throw new InventoryServiceError('NOT_FOUND', 'المنتج غير موجود', 404);
    }

    // Fetch current aggregate stock
    const products = await this.getProducts(merchantId, tenantId);
    const fresh = products.find((p) => p.id === safeProductId);

    return fresh || {
      id: updated.id,
      merchantId: updated.merchant_id,
      name: updated.name,
      sku: updated.sku,
      barcode: updated.barcode || undefined,
      category: updated.category,
      costPrice: Number(updated.cost_price),
      sellingPrice: Number(updated.selling_price),
      stockQuantity: 0,
      minStockAlert: Number(updated.min_stock_alert),
      unit: updated.unit,
      locationRack: updated.location_rack || undefined,
      notes: updated.notes || undefined,
      updatedAt: updated.updated_at,
    };
  }

  /**
   * Soft delete product to protect historical financial and stock audit references
   */
  async deleteProduct(merchantId: string, tenantId: string, productId: string): Promise<{ success: boolean; message: string }> {
    const safeMerchantId = ensureUuid(merchantId);
    const safeTenantId = ensureUuid(tenantId);
    const safeProductId = ensureUuid(productId);

    const { error } = await this.supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', safeProductId)
      .eq('merchant_id', safeMerchantId)
      .eq('tenant_id', safeTenantId);

    if (error) {
      throw new InventoryServiceError('DB_ERROR', `فشل حذف المنتج: ${error.message}`, 500);
    }

    return { success: true, message: 'تم أرشفة المنتج بنجاح مع الحفاظ على سجل المبيعات والمخزون' };
  }

  /**
   * Execute atomic stock adjustment with Idempotency and Negative Stock Guard.
   * Authoritative RPC execution ONLY: calls execute_stock_adjustment in PostgreSQL.
   * Fails closed if the RPC fails; no direct mutation fallbacks permitted.
   * Tracks keys in public.inventory_idempotency_keys.
   */
  async adjustStock(
    merchantId: string,
    tenantId: string,
    params: {
      productId: string;
      quantityChange: number;
      branchId?: string;
      type?: string;
      referenceNumber?: string;
      notes?: string;
      performedByUserId?: string;
      idempotencyKey?: string;
    }
  ): Promise<{ success: boolean; newStock: number; movementId?: string; message: string }> {
    const safeMerchantId = ensureUuid(merchantId);
    const safeTenantId = ensureUuid(tenantId);
    const safeProductId = ensureUuid(params.productId);
    const safeBranchId = params.branchId && isValidUuid(params.branchId) ? params.branchId : undefined;

    if (!params.quantityChange || params.quantityChange === 0) {
      throw new InventoryServiceError('INVALID_QUANTITY', 'كمية التعديل يجب أن تكون غير صفرية', 400);
    }

    // Resolve canonical movement type
    let resolvedMovementType: string | null = null;
    if (params.type) {
      if (params.type === 'ADJUSTMENT_ADD' || params.type === 'ADJUSTMENT_REMOVE') {
        resolvedMovementType = params.type;
      } else if (params.type === 'ADJUSTMENT') {
        resolvedMovementType = params.quantityChange > 0 ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_REMOVE';
      } else {
        resolvedMovementType = params.type;
      }
    } else {
      resolvedMovementType = params.quantityChange > 0 ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_REMOVE';
    }

    // Authoritative RPC Execution ONLY (fail-closed, no direct mutation fallback)
    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_stock_adjustment', {
      p_tenant_id: safeTenantId,
      p_merchant_id: safeMerchantId,
      p_branch_id: safeBranchId || null,
      p_product_id: safeProductId,
      p_quantity_change: Math.floor(params.quantityChange),
      p_movement_type: resolvedMovementType,
      p_reference_number: params.referenceNumber || null,
      p_notes: params.notes || 'تعديل جرد يدوي بالمستودع',
      p_performed_by: params.performedByUserId && isValidUuid(params.performedByUserId) ? params.performedByUserId : null,
      p_idempotency_key: params.idempotencyKey && params.idempotencyKey.trim() !== '' ? params.idempotencyKey.trim() : null,
    });

    if (rpcErr) {
      const errMsg = rpcErr.message || '';
      if (errMsg.includes('INSUFFICIENT_STOCK')) {
        throw new InventoryServiceError('INSUFFICIENT_STOCK', 'المخزون المتوفر غير كافٍ لإجراء هذا التعديل (الرصيد لا يمكن أن يكون سالباً)', 400);
      }
      if (errMsg.includes('IDEMPOTENCY_REPLAY_MISMATCH') || errMsg.includes('IDEMPOTENCY_MISMATCH')) {
        throw new InventoryServiceError('IDEMPOTENCY_MISMATCH', 'مفتاح التكرار مستخدم سابقاً مع بيانات مختلفة', 400);
      }
      if (errMsg.includes('BRANCH_NOT_FOUND')) {
        throw new InventoryServiceError('BRANCH_NOT_FOUND', 'الفرع المحدد غير موجود أو غير تابع لهذا التاجر', 404);
      }
      if (errMsg.includes('BRANCH_REQUIRED')) {
        throw new InventoryServiceError('BRANCH_REQUIRED', 'لا يوجد فرع نشط مسجل للتاجر لتنفيذ حركة المخزون عليه', 400);
      }
      if (errMsg.includes('PRODUCT_NOT_FOUND')) {
        throw new InventoryServiceError('PRODUCT_NOT_FOUND', 'المنتج غير موجود في سجلات التاجر', 404);
      }
      if (errMsg.includes('INVALID_QUANTITY')) {
        throw new InventoryServiceError('INVALID_QUANTITY', 'كمية التعديل يجب أن تكون غير صفرية', 400);
      }
      throw new InventoryServiceError('RPC_ERROR', `فشل تنفيذ تعديل المخزون عبر الخادم: ${errMsg}`, 500);
    }

    if (!rpcRes || !rpcRes.success) {
      throw new InventoryServiceError('RPC_ERROR', 'فشل تنفيذ تعديل المخزون عبر الخادم', 500);
    }

    return {
      success: true,
      newStock: rpcRes.newStock,
      movementId: rpcRes.movementId,
      message: 'تم تعديل الرصيد المخزني وتسجيل حركة الجرد بنجاح',
    };
  }

  /**
   * Execute atomic inter-branch stock transfer.
   * Authoritative RPC execution ONLY: calls execute_stock_transfer in PostgreSQL.
   * Fails closed if the RPC fails; no direct mutation fallbacks permitted.
   */
  async transferStock(
    merchantId: string,
    tenantId: string,
    params: {
      sourceBranchId: string;
      destinationBranchId: string;
      productId: string;
      quantity: number;
      notes?: string;
      performedByUserId?: string;
      idempotencyKey?: string;
    }
  ): Promise<{ success: boolean; transferId: string; message: string }> {
    const safeMerchantId = ensureUuid(merchantId);
    const safeTenantId = ensureUuid(tenantId);
    const safeProductId = ensureUuid(params.productId);
    const safeSrcBranch = ensureUuid(params.sourceBranchId);
    const safeDstBranch = ensureUuid(params.destinationBranchId);
    const qty = Math.floor(params.quantity);

    if (!qty || qty <= 0) {
      throw new InventoryServiceError('INVALID_QUANTITY', 'كمية المناقلة يجب أن تكون أكبر من صفر', 400);
    }

    if (safeSrcBranch === safeDstBranch) {
      throw new InventoryServiceError('SAME_BRANCH_TRANSFER', 'لا يمكن المناقلة إلى نفس الفرع', 400);
    }

    // Authoritative RPC Execution ONLY (fail-closed, no direct mutation fallback)
    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_stock_transfer', {
      p_tenant_id: safeTenantId,
      p_merchant_id: safeMerchantId,
      p_source_branch_id: safeSrcBranch,
      p_destination_branch_id: safeDstBranch,
      p_product_id: safeProductId,
      p_quantity: qty,
      p_notes: params.notes || 'مناقلة مخزنية بين الفروع',
      p_performed_by: params.performedByUserId && isValidUuid(params.performedByUserId) ? params.performedByUserId : null,
      p_idempotency_key: params.idempotencyKey && params.idempotencyKey.trim() !== '' ? params.idempotencyKey.trim() : null,
    });

    if (rpcErr) {
      const errMsg = rpcErr.message || '';
      if (errMsg.includes('INSUFFICIENT_STOCK')) {
        throw new InventoryServiceError('INSUFFICIENT_STOCK', 'المخزون المتوفر في فرع المصدر غير كافٍ لإتمام المناقلة', 400);
      }
      if (errMsg.includes('IDEMPOTENCY_REPLAY_MISMATCH') || errMsg.includes('IDEMPOTENCY_MISMATCH')) {
        throw new InventoryServiceError('IDEMPOTENCY_MISMATCH', 'مفتاح التكرار مستخدم سابقاً مع بيانات مختلفة', 400);
      }
      if (errMsg.includes('SAME_BRANCH_TRANSFER')) {
        throw new InventoryServiceError('SAME_BRANCH_TRANSFER', 'لا يمكن المناقلة إلى نفس الفرع', 400);
      }
      if (errMsg.includes('SOURCE_BRANCH_NOT_FOUND')) {
        throw new InventoryServiceError('SOURCE_BRANCH_NOT_FOUND', 'فرع المصدر غير موجود أو لا ينتمي للتاجر الحالي', 404);
      }
      if (errMsg.includes('DESTINATION_BRANCH_NOT_FOUND')) {
        throw new InventoryServiceError('DESTINATION_BRANCH_NOT_FOUND', 'فرع الوجهة غير موجود أو لا ينتمي للتاجر الحالي', 404);
      }
      if (errMsg.includes('PRODUCT_NOT_FOUND')) {
        throw new InventoryServiceError('PRODUCT_NOT_FOUND', 'المنتج المطلوب مناقلته غير موجود في سجلات التاجر', 404);
      }
      if (errMsg.includes('INVALID_QUANTITY')) {
        throw new InventoryServiceError('INVALID_QUANTITY', 'كمية المناقلة يجب أن تكون أكبر من صفر', 400);
      }
      throw new InventoryServiceError('RPC_ERROR', `فشل تنفيذ المناقلة عبر الخادم: ${errMsg}`, 500);
    }

    if (!rpcRes || !rpcRes.success) {
      throw new InventoryServiceError('RPC_ERROR', 'فشل تنفيذ عملية المناقلة عبر الخادم', 500);
    }

    return {
      success: true,
      transferId: rpcRes.transferId,
      message: 'تمت المناقلة بنجاح وتحديث أرصدة الفرعين وتسجيل حركتي المخزون',
    };
  }

  /**
   * Fetch Stock Movements from Supabase
   */
  async getStockMovements(merchantId: string, tenantId: string = '00000000-0000-0000-0000-000000000001'): Promise<StockMovementDTO[]> {
    const safeMerchantId = ensureUuid(merchantId);
    const safeTenantId = ensureUuid(tenantId);

    const { data: rawMovements, error } = await this.supabase
      .from('stock_movements')
      .select('*, products(name, sku)')
      .eq('merchant_id', safeMerchantId)
      .eq('tenant_id', safeTenantId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !rawMovements) {
      return [];
    }

    return rawMovements.map((m) => {
      let mType: StockMovementDTO['type'] = 'ADJUSTMENT';
      if (m.movement_type === 'IN_PURCHASE' || m.movement_type === 'INBOUND_PURCHASE') mType = 'IN_PURCHASE';
      else if (m.movement_type === 'OUT_SALE' || m.movement_type === 'OUTBOUND_SALE') mType = 'OUT_SALE';
      else if (m.movement_type === 'TRANSFER_IN') mType = 'TRANSFER_IN';
      else if (m.movement_type === 'TRANSFER_OUT' || m.movement_type === 'OUT_SHIPPING') mType = 'TRANSFER_OUT';
      else if (m.movement_type === 'RETURN_CUSTOMER' || m.movement_type === 'RETURN_RESTOCK' || m.movement_type === 'RETURN_IN') mType = 'RETURN_IN';
      else if (m.movement_type === 'DAMAGE_WRITE_OFF' || m.movement_type === 'DAMAGE_OUT') mType = 'DAMAGE_OUT';
      else if (m.movement_type === 'ADJUSTMENT_ADD' || m.movement_type === 'ADJUSTMENT_REMOVE' || m.movement_type === 'ADJUSTMENT') mType = 'ADJUSTMENT';

      return {
        id: m.id,
        productId: m.product_id,
        productName: m.products?.name || 'منتج',
        sku: m.products?.sku || '',
        type: mType,
        quantityChange: Number(m.quantity) || 0,
        previousStock: Number(m.balance_before) || 0,
        newStock: Number(m.balance_after) || 0,
        referenceNumber: m.reference_number || m.reference_id || 'N/A',
        notes: m.notes || undefined,
        timestamp: m.created_at,
        performedBy: m.performed_by || 'نظام المستودعات',
      };
    });
  }

  /**
   * Fetch Stock Transfers from Supabase
   */
  async getStockTransfers(merchantId: string, tenantId: string = '00000000-0000-0000-0000-000000000001'): Promise<StockTransferDTO[]> {
    const safeMerchantId = ensureUuid(merchantId);
    const safeTenantId = ensureUuid(tenantId);

    const { data: rawTransfers, error } = await this.supabase
      .from('merchant_stock_transfers')
      .select('*, merchant_stock_transfer_items(*, products(name, sku)), src:source_branch_id(name), dst:destination_branch_id(name)')
      .eq('merchant_id', safeMerchantId)
      .eq('tenant_id', safeTenantId)
      .order('created_at', { ascending: false });

    if (error || !rawTransfers) {
      return [];
    }

    const results: StockTransferDTO[] = [];
    for (const t of rawTransfers) {
      const items = t.merchant_stock_transfer_items || [];
      const firstItem = items[0] || {};
      const prod = firstItem.products || {};

      results.push({
        id: t.id,
        transferNumber: t.transfer_number || `TR-${t.id.substring(0, 8)}`,
        sourceBranchId: t.source_branch_id,
        sourceBranchName: t.src?.name || 'الفرع الرئيسي',
        destinationBranchId: t.destination_branch_id,
        destinationBranchName: t.dst?.name || 'فرع المستودع',
        productId: firstItem.product_id || '',
        productName: prod.name || 'منتج',
        sku: prod.sku || '',
        quantity: Number(firstItem.quantity) || 0,
        status: t.status || 'COMPLETED',
        notes: t.notes || undefined,
        createdBy: t.created_by || 'مدير المستودع',
        createdAt: t.created_at,
      });
    }

    return results;
  }

  /**
   * Get complete Warehouse Data view (products, movements, stats) with RBAC cost masking
   */
  async getWarehouse(
    merchantId: string,
    tenantId: string,
    canSeeCostPrice: boolean = true
  ): Promise<{ products: MerchantProductDTO[]; movements: StockMovementDTO[]; stats: WarehouseStatsDTO }> {
    const products = await this.getProducts(merchantId, tenantId);
    const movements = await this.getStockMovements(merchantId, tenantId);

    let totalSkus = products.length;
    let totalQuantity = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;
    let lowStockCount = 0;
    const lowStockProducts: MerchantProductDTO[] = [];

    for (const p of products) {
      totalQuantity += p.stockQuantity;
      totalCostValue += p.stockQuantity * p.costPrice;
      totalRetailValue += p.stockQuantity * p.sellingPrice;

      if (p.stockQuantity <= p.minStockAlert) {
        lowStockCount++;
        lowStockProducts.push(p);
      }
    }

    const potentialGrossProfit = totalRetailValue - totalCostValue;
    const marginPercent = totalRetailValue > 0 ? (potentialGrossProfit / totalRetailValue) * 100 : 0;

    // Mask cost price if user lacks view_cost_price permission
    const sanitizedProducts = products.map((p) => ({
      ...p,
      costPrice: canSeeCostPrice ? p.costPrice : 0,
    }));

    const sanitizedLowStock = lowStockProducts.map((p) => ({
      ...p,
      costPrice: canSeeCostPrice ? p.costPrice : 0,
    }));

    return {
      products: sanitizedProducts,
      movements,
      stats: {
        totalSkus,
        totalQuantity,
        totalCostValue: canSeeCostPrice ? totalCostValue : 0,
        totalRetailValue,
        potentialGrossProfit: canSeeCostPrice ? potentialGrossProfit : 0,
        marginPercent: canSeeCostPrice ? Math.round(marginPercent * 100) / 100 : 0,
        lowStockCount,
        lowStockProducts: sanitizedLowStock,
      },
    };
  }
}

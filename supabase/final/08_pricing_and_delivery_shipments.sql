-- ============================================================================
-- DELIVERE — 08_pricing_and_delivery_shipments.sql
-- Price Plans & Authoritative Delivery Shipments with Durable Financial Snapshots
-- ============================================================================

-- 1. Price Plans Table
CREATE TABLE IF NOT EXISTS public.price_plans (
    id TEXT PRIMARY KEY DEFAULT ('pp-' || substr(md5(random()::text), 1, 8)),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID,
    name TEXT NOT NULL,
    type public.price_plan_type NOT NULL DEFAULT 'MERCHANT',
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    default_fee NUMERIC(12, 3) NOT NULL DEFAULT 3.000,
    governorate_fees JSONB NOT NULL DEFAULT '{}'::jsonb,
    return_fee NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
    extra_weight_fee_per_kg NUMERIC(12, 3) NOT NULL DEFAULT 0.500,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_price_plans_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_price_plans_lookup ON public.price_plans (tenant_id, type, is_default);

-- 2. Durable Point-to-Point Pricing Rules (Origin / Destination Matrix)
CREATE TABLE IF NOT EXISTS public.price_plan_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    price_plan_id TEXT NOT NULL,
    from_governorate TEXT NOT NULL DEFAULT 'عمان',
    from_sub_region TEXT,
    to_governorate TEXT NOT NULL,
    to_sub_region TEXT,
    order_type TEXT NOT NULL DEFAULT 'عادي',
    price NUMERIC(12, 3) NOT NULL DEFAULT 3.000,
    return_discount NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    fixed_return NUMERIC(12, 3),
    driver_discount NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    fixed_driver_cost NUMERIC(12, 3),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_plan_rules_lookup 
    ON public.price_plan_rules (tenant_id, price_plan_id, to_governorate, is_active);

-- 3. Authoritative Shipments Table (Primary Delivery Registry)
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sequence TEXT NOT NULL,
    merchant_id UUID NOT NULL,
    branch_id UUID,
    driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    price_plan_id TEXT,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_phone2 TEXT,
    governorate TEXT NOT NULL DEFAULT 'عمان',
    area TEXT,
    address TEXT,
    package_details TEXT,
    notes TEXT,
    status public.shipment_status NOT NULL DEFAULT 'CREATED',
    payment_type public.payment_type NOT NULL DEFAULT 'COD',
    weight NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
    pieces INTEGER NOT NULL DEFAULT 1,
    barcode TEXT,
    otp TEXT,
    pod_signature_url TEXT,
    pod_image_url TEXT,
    is_fragile BOOLEAN NOT NULL DEFAULT false,
    allow_opening BOOLEAN NOT NULL DEFAULT true,
    delivery_attempts INTEGER NOT NULL DEFAULT 0,
    assigned_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    settlement_status public.settlement_status NOT NULL DEFAULT 'DRAFT',
    merchant_settlement_id UUID,
    driver_settlement_id UUID,

    -- ========================================================================
    -- IMMUTABLE FINANCIAL SNAPSHOTS (NUMERIC 12, 3 JOD)
    -- ========================================================================
    cod_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000,           -- Gross customer collection
    merchant_collection NUMERIC(12, 3) NOT NULL DEFAULT 0.000,  -- Net merchandise payable to merchant
    delivery_fee NUMERIC(12, 3) NOT NULL DEFAULT 0.000,         -- Tariff revenue owed to Delivere
    driver_fee NUMERIC(12, 3),                                  -- Snapshotted compensation when driver assigned
    return_fee NUMERIC(12, 3),                                  -- Snapshotted return tariff when returned
    extra_weight_fee NUMERIC(12, 3) NOT NULL DEFAULT 0.000,     -- Snapshotted extra weight surcharge
    currency TEXT NOT NULL DEFAULT 'JOD',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK ensuring merchant belongs to the same tenant
    CONSTRAINT fk_shipments_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,

    -- Composite unique constraint for composite foreign referencing
    CONSTRAINT uq_shipments_composite UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_tenant_sequence ON public.shipments (tenant_id, sequence);
CREATE INDEX IF NOT EXISTS idx_shipments_tenant_status ON public.shipments (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_merchant ON public.shipments (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_driver ON public.shipments (driver_id, status) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_branch ON public.shipments (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_barcode ON public.shipments (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_recipient_phone ON public.shipments (recipient_phone);

-- View: Backward-compatible 'orders' query & mutation interface
CREATE OR REPLACE VIEW public.orders AS
    SELECT * FROM public.shipments;

-- INSTEAD OF Triggers to guarantee 100% deterministic write compatibility
CREATE OR REPLACE FUNCTION public.orders_view_insert_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.shipments (
        id, tenant_id, sequence, merchant_id, branch_id, driver_id, price_plan_id,
        recipient_name, recipient_phone, recipient_phone2, governorate,
        area, address, package_details, notes, status, payment_type,
        weight, pieces, barcode, otp, pod_signature_url, pod_image_url,
        is_fragile, allow_opening, delivery_attempts, assigned_at,
        delivered_at, returned_at, settlement_status, merchant_settlement_id,
        driver_settlement_id, cod_amount, merchant_collection, delivery_fee,
        driver_fee, return_fee, extra_weight_fee, currency, created_at, updated_at
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()), NEW.tenant_id, NEW.sequence, NEW.merchant_id, NEW.branch_id, NEW.driver_id, NEW.price_plan_id,
        NEW.recipient_name, NEW.recipient_phone, NEW.recipient_phone2, COALESCE(NEW.governorate, 'عمان'),
        NEW.area, NEW.address, NEW.package_details, NEW.notes, COALESCE(NEW.status, 'CREATED'), COALESCE(NEW.payment_type, 'COD'),
        COALESCE(NEW.weight, 1.00), COALESCE(NEW.pieces, 1), NEW.barcode, NEW.otp, NEW.pod_signature_url, NEW.pod_image_url,
        COALESCE(NEW.is_fragile, false), COALESCE(NEW.allow_opening, true), COALESCE(NEW.delivery_attempts, 0), NEW.assigned_at,
        NEW.delivered_at, NEW.returned_at, COALESCE(NEW.settlement_status, 'DRAFT'), NEW.merchant_settlement_id,
        NEW.driver_settlement_id, COALESCE(NEW.cod_amount, 0.000), COALESCE(NEW.merchant_collection, 0.000), COALESCE(NEW.delivery_fee, 0.000),
        NEW.driver_fee, NEW.return_fee, COALESCE(NEW.extra_weight_fee, 0.000), COALESCE(NEW.currency, 'JOD'), COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
    )
    RETURNING * INTO NEW;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_view_insert ON public.orders;
CREATE TRIGGER trg_orders_view_insert
    INSTEAD OF INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.orders_view_insert_handler();

CREATE OR REPLACE FUNCTION public.orders_view_update_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.shipments
    SET
        tenant_id = NEW.tenant_id,
        sequence = NEW.sequence,
        merchant_id = NEW.merchant_id,
        branch_id = NEW.branch_id,
        driver_id = NEW.driver_id,
        price_plan_id = NEW.price_plan_id,
        recipient_name = NEW.recipient_name,
        recipient_phone = NEW.recipient_phone,
        recipient_phone2 = NEW.recipient_phone2,
        governorate = NEW.governorate,
        area = NEW.area,
        address = NEW.address,
        package_details = NEW.package_details,
        notes = NEW.notes,
        status = NEW.status,
        payment_type = NEW.payment_type,
        weight = NEW.weight,
        pieces = NEW.pieces,
        barcode = NEW.barcode,
        otp = NEW.otp,
        pod_signature_url = NEW.pod_signature_url,
        pod_image_url = NEW.pod_image_url,
        is_fragile = NEW.is_fragile,
        allow_opening = NEW.allow_opening,
        delivery_attempts = NEW.delivery_attempts,
        assigned_at = NEW.assigned_at,
        delivered_at = NEW.delivered_at,
        returned_at = NEW.returned_at,
        settlement_status = NEW.settlement_status,
        merchant_settlement_id = NEW.merchant_settlement_id,
        driver_settlement_id = NEW.driver_settlement_id,
        cod_amount = NEW.cod_amount,
        merchant_collection = NEW.merchant_collection,
        delivery_fee = NEW.delivery_fee,
        driver_fee = NEW.driver_fee,
        return_fee = NEW.return_fee,
        extra_weight_fee = NEW.extra_weight_fee,
        currency = NEW.currency,
        updated_at = now()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_view_update ON public.orders;
CREATE TRIGGER trg_orders_view_update
    INSTEAD OF UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.orders_view_update_handler();

CREATE OR REPLACE FUNCTION public.orders_view_delete_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status NOT IN ('CREATED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Cannot delete order % in status % (Only CREATED or CANCELLED orders without financial postings may be deleted)', 
            OLD.id, OLD.status;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.financial_obligations WHERE shipment_id = OLD.id
    ) OR EXISTS (
        SELECT 1 FROM public.journal_lines WHERE description LIKE '%' || OLD.sequence || '%'
    ) THEN
        RAISE EXCEPTION 'Cannot delete order % with existing financial records', OLD.id;
    END IF;

    DELETE FROM public.shipments WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_view_delete ON public.orders;
CREATE TRIGGER trg_orders_view_delete
    INSTEAD OF DELETE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.orders_view_delete_handler();

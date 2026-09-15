-- ==============================================================================
-- DarGo Logistics & Enterprise POS - Complete Production Database Schema
-- Optimized for PostgreSQL 14+ / Supabase
-- Target Concurrency: 10,000+ Concurrent Active Users
-- Multi-Tenant Isolation | Hierarchical RBAC | OPS Subdomain | Enterprise POS
-- Safe for both Fresh Installs and Existing Database Upgrades (Idempotent)
-- ==============================================================================

-- 1. EXTENSIONS & GLOBAL CONFIGURATION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically update timestamp on modified records
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. TENANTS & SUBSCRIPTIONS (عزل الشركات ومنظومة OPS المركزية)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    monthly_price NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    annual_price NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    max_orders_per_month INTEGER DEFAULT 1000,
    max_users INTEGER DEFAULT 10,
    max_branches INTEGER DEFAULT 2,
    features JSONB DEFAULT '[]'::jsonb NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    commercial_number TEXT,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    subscription_status TEXT DEFAULT 'ACTIVE' CHECK (subscription_status IN ('ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED')),
    subscription_expires_at TIMESTAMPTZ,
    max_orders_limit INTEGER DEFAULT 5000,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 3. USERS & HIERARCHICAL RBAC
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    role_name TEXT,
    portal_access TEXT DEFAULT 'STANDARD',
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    commercial_name TEXT,
    commercial_type TEXT,
    city TEXT DEFAULT 'عمان',
    address TEXT,
    branch TEXT DEFAULT 'المقر الرئيسي',
    department TEXT,
    price_list TEXT DEFAULT 'جميع المملكة 2',
    account_manager TEXT,
    vehicle_type TEXT,
    vehicle_plate TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    parent_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
    max_allowed_permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 4. SAFE COLUMN MIGRATIONS (لضمان إضافة الأعمدة إذا كانت الجداول موجودة مسبقاً)
-- ==============================================================================
DO $$ 
BEGIN
    -- users table columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS portal_access TEXT DEFAULT 'STANDARD';
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS max_allowed_permissions JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON public.users(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 5. CATEGORIES & TAXONOMY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    is_system_default BOOLEAN DEFAULT FALSE NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_merchant ON public.categories(merchant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON public.categories(tenant_id);

-- ==============================================================================
-- 6. PRODUCTS & WAREHOUSE INVENTORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    category TEXT DEFAULT 'عام' NOT NULL,
    unit TEXT DEFAULT 'قطعة' NOT NULL,
    cost_price NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    selling_price NUMERIC(12, 3) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 5 NOT NULL,
    shelf_location TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_merchant ON public.products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(merchant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(merchant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(merchant_id, category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(merchant_id, is_active);

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stock Movement Audit Log
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    unit_cost NUMERIC(12, 3) DEFAULT 0.000,
    reference_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inventory_tx_prod ON public.inventory_transactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_merchant ON public.inventory_transactions(merchant_id, created_at DESC);

-- ==============================================================================
-- 7. POS CASHIER & FAST CHECKOUT TRANSACTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pos_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    sale_number TEXT UNIQUE NOT NULL,
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    cashier_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sale_type TEXT NOT NULL,
    subtotal NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    discount_amount NUMERIC(12, 3) DEFAULT 0.000,
    delivery_fee NUMERIC(12, 3) DEFAULT 0.000,
    total NUMERIC(12, 3) NOT NULL,
    payment_method TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    status TEXT DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pos_sales_tenant ON public.pos_sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_merchant_date ON public.pos_sales(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_cashier ON public.pos_sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_number ON public.pos_sales(sale_number);

CREATE TABLE IF NOT EXISTS public.pos_sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES public.pos_sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 3) NOT NULL,
    total_price NUMERIC(12, 3) NOT NULL,
    cost_price NUMERIC(12, 3) DEFAULT 0.000
);

CREATE INDEX IF NOT EXISTS idx_pos_items_sale ON public.pos_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_product ON public.pos_sale_items(product_id);

-- ==============================================================================
-- 8. SHIPMENTS & LOGISTICS FLEET
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    tracking_number TEXT UNIQUE NOT NULL,
    reference_number TEXT,
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    payment_type TEXT NOT NULL DEFAULT 'COD',
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_phone_alt TEXT,
    governorate TEXT NOT NULL,
    area TEXT NOT NULL,
    full_address TEXT NOT NULL,
    order_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    delivery_fee NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    total_collected NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    net_merchant_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    driver_commission NUMERIC(12, 3) DEFAULT 0.000,
    notes TEXT,
    items_count INTEGER DEFAULT 1,
    attempt_count INTEGER DEFAULT 0,
    delivered_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    pod_image_url TEXT,
    pod_signature TEXT,
    is_settled_with_merchant BOOLEAN DEFAULT FALSE,
    is_settled_with_driver BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON public.shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON public.shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_merchant_status ON public.shipments(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_driver_status ON public.shipments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_governorate ON public.shipments(governorate);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON public.shipments(created_at DESC);

DROP TRIGGER IF EXISTS trg_shipments_updated_at ON public.shipments;
CREATE TRIGGER trg_shipments_updated_at BEFORE UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Shipment History Status Tracking Logs
CREATE TABLE IF NOT EXISTS public.shipment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shipment_logs_shipment ON public.shipment_logs(shipment_id, created_at DESC);

-- ==============================================================================
-- 9. DOUBLE-ENTRY ACCOUNTING & SETTLEMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    entry_number TEXT UNIQUE NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE NOT NULL,
    description TEXT NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    total_debit NUMERIC(12, 3) NOT NULL,
    total_credit NUMERIC(12, 3) NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT NOT NULL,
    description TEXT,
    debit NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    credit NUMERIC(12, 3) DEFAULT 0.000 NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_entry_lines(account_id);

CREATE TABLE IF NOT EXISTS public.merchant_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    settlement_number TEXT UNIQUE NOT NULL,
    merchant_id UUID REFERENCES public.users(id) ON DELETE RESTRICT NOT NULL,
    total_cod_amount NUMERIC(12, 3) NOT NULL,
    total_fees NUMERIC(12, 3) NOT NULL,
    net_payout NUMERIC(12, 3) NOT NULL,
    payout_method TEXT DEFAULT 'CLIQ',
    transaction_ref TEXT,
    status TEXT DEFAULT 'PENDING',
    processed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.merchant_settlements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    expense_number TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 3) NOT NULL,
    payment_method TEXT DEFAULT 'CASH',
    recipient TEXT,
    expense_date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    receipt_url TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_expenses_date_mer ON public.expenses(expense_date DESC);

-- ==============================================================================
-- 10. INVOICES & BILLING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_type TEXT NOT NULL,
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    customer_or_supplier_name TEXT NOT NULL,
    customer_phone TEXT,
    issue_date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE,
    subtotal NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    tax_amount NUMERIC(12, 3) DEFAULT 0.000,
    discount_amount NUMERIC(12, 3) DEFAULT 0.000,
    total_amount NUMERIC(12, 3) NOT NULL,
    paid_amount NUMERIC(12, 3) DEFAULT 0.000,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 3) NOT NULL,
    total_price NUMERIC(12, 3) NOT NULL,
    cost_price NUMERIC(12, 3) DEFAULT 0.000
);

-- ==============================================================================
-- 11. ATOMIC STORED PROCEDURES
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.execute_pos_sale(
    p_merchant_id UUID,
    p_cashier_id UUID,
    p_sale_number TEXT,
    p_sale_type TEXT,
    p_subtotal NUMERIC,
    p_discount NUMERIC,
    p_delivery_fee NUMERIC,
    p_total NUMERIC,
    p_payment_method TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_quantity INT;
    v_unit_price NUMERIC;
    v_cost_price NUMERIC;
    v_prod_name TEXT;
    v_curr_stock INT;
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = p_merchant_id;

    INSERT INTO public.pos_sales (
        tenant_id, sale_number, merchant_id, cashier_id, sale_type,
        subtotal, discount_amount, delivery_fee, total,
        payment_method, customer_name, customer_phone
    ) VALUES (
        v_tenant_id, p_sale_number, p_merchant_id, p_cashier_id, p_sale_type,
        p_subtotal, p_discount, p_delivery_fee, p_total,
        p_payment_method, p_customer_name, p_customer_phone
    ) RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INT;
        v_unit_price := (v_item->>'unit_price')::NUMERIC;
        v_cost_price := COALESCE((v_item->>'cost_price')::NUMERIC, 0.000);
        v_prod_name := v_item->>'name';

        INSERT INTO public.pos_sale_items (
            sale_id, product_id, product_name, quantity, unit_price, total_price, cost_price
        ) VALUES (
            v_sale_id, v_product_id, v_prod_name, v_quantity, v_unit_price, (v_quantity * v_unit_price), v_cost_price
        );

        IF v_product_id IS NOT NULL THEN
            SELECT stock_quantity INTO v_curr_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
            
            UPDATE public.products
            SET stock_quantity = stock_quantity - v_quantity,
                updated_at = NOW()
            WHERE id = v_product_id;

            INSERT INTO public.inventory_transactions (
                tenant_id, merchant_id, product_id, user_id, transaction_type,
                quantity, previous_stock, new_stock, unit_cost, reference_id, notes
            ) VALUES (
                v_tenant_id, p_merchant_id, v_product_id, p_cashier_id, 'POS_SALE',
                -v_quantity, v_curr_stock, (v_curr_stock - v_quantity), v_cost_price, p_sale_number, 'مبيعات كاشير فورية'
            );
        END IF;
    END LOOP;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_all_tenants ON public.tenants;
CREATE POLICY super_admin_all_tenants ON public.tenants FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');

DROP POLICY IF EXISTS super_admin_all_users ON public.users;
CREATE POLICY super_admin_all_users ON public.users FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');

DROP POLICY IF EXISTS super_admin_all_plans ON public.subscription_plans;
CREATE POLICY super_admin_all_plans ON public.subscription_plans FOR ALL USING (TRUE);

DROP POLICY IF EXISTS tenant_users_isolation ON public.users;
CREATE POLICY tenant_users_isolation ON public.users FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS tenant_products_isolation ON public.products;
CREATE POLICY tenant_products_isolation ON public.products FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS tenant_shipments_isolation ON public.shipments;
CREATE POLICY tenant_shipments_isolation ON public.shipments FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS tenant_pos_isolation ON public.pos_sales;
CREATE POLICY tenant_pos_isolation ON public.pos_sales FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);

-- ==============================================================================
-- 13. INITIAL SEEDS: PLANS, SUPER ADMIN ACCOUNT & DEFAULTS
-- ==============================================================================
INSERT INTO public.subscription_plans (code, name, monthly_price, annual_price, max_orders_per_month, max_users, features) VALUES
('STARTER', 'باقة البداية (Starter)', 25.000, 250.000, 500, 3, '["orders.create", "orders.track", "pos.basic"]'::jsonb),
('PRO_GROWTH', 'باقة الشركات والنمو (Growth)', 60.000, 600.000, 3000, 15, '["orders.bulk", "dispatch.fleet", "pos.full", "accounting.basic", "merchants.portal"]'::jsonb),
('ENTERPRISE', 'باقة المنظومة المتكاملة (Enterprise)', 150.000, 1500.000, 25000, 100, '["all_modules", "api.webhook", "route.optimizer", "accounting.full", "white_label"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- حساب السوبر أدمن المعتمد
INSERT INTO public.users (
    id,
    name,
    email,
    phone,
    password_hash,
    role,
    role_name,
    portal_access,
    branch,
    city,
    is_active,
    permissions,
    max_allowed_permissions
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'المدير العام للنظام (Super Admin)',
    'admin@dargo-tms.io',
    '0790000001',
    crypt('admin123', gen_salt('bf')),
    'SUPER_ADMIN',
    'المدير العام للنظام (Super Admin)',
    'OPS',
    'المقر الرئيسي للمملكة',
    'عمان',
    TRUE,
    '["manage_system_settings", "manage_operations_admins", "view_financial_audit_logs", "export_database_backup", "users.manage_operations", "users.manage_staff"]'::jsonb,
    '["manage_system_settings", "manage_operations_admins", "view_financial_audit_logs", "export_database_backup", "users.manage_operations", "users.manage_staff"]'::jsonb
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.chart_of_accounts (tenant_id, code, name, type, description) VALUES
(NULL, '1010', 'الصندوق والنقدية (Cash)', 'ASSET', 'النقدية المتوفرة في الكاشير والخزينة الرئيسية'),
(NULL, '1020', 'الحساب البنكي و CliQ', 'ASSET', 'حسابات الدفع الإلكتروني والتحويل البنكي'),
(NULL, '1030', 'ذمم كباتن التوصيل (Drivers COD)', 'ASSET', 'المبالغ النقدية المحصلة مع المناديب وبانتظار التوريد'),
(NULL, '1040', 'المخزون السلعي (Inventory)', 'ASSET', 'قيمة بضاعة المستودع بسعر التكلفة'),
(NULL, '2010', 'مستحقات التجار (Merchants Payables)', 'LIABILITY', 'صافي مستحقات المتاجر في المحفظة'),
(NULL, '4010', 'إيرادات المبيعات (Sales Revenue)', 'REVENUE', 'إجمالي مبيعات المتجر ونقاط البيع POS'),
(NULL, '4020', 'إيرادات التوصيل والشحن (Delivery Revenue)', 'REVENUE', 'رسوم شحن وتوصيل الطرود'),
(NULL, '5010', 'تكلفة البضاعة المباعة (COGS)', 'EXPENSE', 'تكلفة المنتجات المباعة'),
(NULL, '5020', 'عمولات السائقين والمناديب', 'EXPENSE', 'بدل توصيل للمناديب عن كل طرد'),
(NULL, '5030', 'المصاريف التشغيلية والإيجارات', 'EXPENSE', 'مصاريف الفرع، رواتب، كهرباء، وصيانة')
ON CONFLICT DO NOTHING;

INSERT INTO public.categories (tenant_id, merchant_id, name, is_system_default, display_order) VALUES
(NULL, NULL, 'ألبسة نسائية', TRUE, 1),
(NULL, NULL, 'عبايات وجلابيات', TRUE, 2),
(NULL, NULL, 'ألبسة رجالية', TRUE, 3),
(NULL, NULL, 'ألبسة أطفال', TRUE, 4),
(NULL, NULL, 'حقائب وأحذية', TRUE, 5),
(NULL, NULL, 'إكسسوارات', TRUE, 6),
(NULL, NULL, 'شالات وإيشاربات', TRUE, 7),
(NULL, NULL, 'عطور وتجميل', TRUE, 8),
(NULL, NULL, 'ساعات ومجوهرات', TRUE, 9),
(NULL, NULL, 'إلكترونيات وهواتف', TRUE, 10),
(NULL, NULL, 'أدوات منزلية', TRUE, 11),
(NULL, NULL, 'عام', TRUE, 12)
ON CONFLICT DO NOTHING;

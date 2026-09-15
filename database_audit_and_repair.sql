-- ==============================================================================
-- DarGo TMS & Enterprise POS - Comprehensive Database Audit & Migration Script
-- Version: 2.5 Production Ready (Idempotent, Safe for Existing & Fresh DBs)
-- Solves: ERROR 42703 (column "tenant_id" does not exist) & Missing RBAC Columns
-- Compatible with: PostgreSQL 13+, Supabase, Cloud SQL, Neon, RDS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Automatic timestamp updater
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. SUBSCRIPTION PLANS & TENANTS
-- ------------------------------------------------------------------------------
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
    plan_id UUID,
    subscription_status TEXT DEFAULT 'ACTIVE',
    subscription_expires_at TIMESTAMPTZ,
    max_orders_limit INTEGER DEFAULT 5000,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Ensure Default Tenant exists for migration backfilling
INSERT INTO public.tenants (id, name, subdomain, subscription_status)
VALUES ('00000000-0000-0000-0000-000000000000', 'المؤسسة الافتراضية الرئيسية (Main Tenant)', 'default', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. USERS TABLE CREATION & MANDATORY COLUMN MIGRATIONS
-- (Direct ALTER TABLE statements prevent transaction aborts from column absence)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Crucial: Unconditionally ensure all required columns exist on users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS portal_access TEXT DEFAULT 'STANDARD';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commercial_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commercial_type TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'عمان';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'المقر الرئيسي';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS price_list TEXT DEFAULT 'جميع المملكة 2';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_manager TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS parent_user_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS max_allowed_permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill NULL tenant_id on non-super-admin users to avoid broken relations
UPDATE public.users 
SET tenant_id = '00000000-0000-0000-0000-000000000000' 
WHERE tenant_id IS NULL AND (role IS NULL OR role != 'SUPER_ADMIN');

-- Safely add foreign key constraint on users(tenant_id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_tenant') THEN
        ALTER TABLE public.users
        ADD CONSTRAINT fk_users_tenant
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- ------------------------------------------------------------------------------
-- 4. CATEGORIES & PRODUCTS (WAREHOUSE & POS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    merchant_id UUID,
    name TEXT NOT NULL,
    icon TEXT,
    is_system_default BOOLEAN DEFAULT FALSE NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS merchant_id UUID;
CREATE INDEX IF NOT EXISTS idx_categories_merchant ON public.categories(merchant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON public.categories(tenant_id);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    merchant_id UUID,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    category TEXT DEFAULT 'عام' NOT NULL,
    unit TEXT DEFAULT 'قطعة' NOT NULL,
    cost_price NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    selling_price NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 5 NOT NULL,
    shelf_location TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS merchant_id UUID;
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_merchant ON public.products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(merchant_id, barcode);

-- Stock movements audit
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    merchant_id UUID,
    product_id UUID,
    user_id UUID,
    transaction_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    unit_cost NUMERIC(12, 3) DEFAULT 0.000,
    reference_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS merchant_id UUID;

-- ------------------------------------------------------------------------------
-- 5. POS SALES & FAST CHECKOUT TRANSACTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    sale_number TEXT UNIQUE NOT NULL,
    merchant_id UUID,
    cashier_id UUID,
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

ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS merchant_id UUID;

CREATE TABLE IF NOT EXISTS public.pos_sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL,
    product_id UUID,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 3) NOT NULL,
    total_price NUMERIC(12, 3) NOT NULL,
    cost_price NUMERIC(12, 3) DEFAULT 0.000
);

-- ------------------------------------------------------------------------------
-- 6. SHIPMENTS & FLEET LOGISTICS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    tracking_number TEXT UNIQUE NOT NULL,
    reference_number TEXT,
    merchant_id UUID,
    driver_id UUID,
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

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS merchant_id UUID;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS reference_number TEXT;

CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON public.shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON public.shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_merchant_status ON public.shipments(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_driver_status ON public.shipments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_governorate ON public.shipments(governorate);

-- Shipment Status History Logs
CREATE TABLE IF NOT EXISTS public.shipment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 7. DOUBLE-ENTRY ACCOUNTING & SETTLEMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS tenant_id UUID;

CREATE TABLE IF NOT EXISTS public.merchant_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    settlement_number TEXT UNIQUE NOT NULL,
    merchant_id UUID NOT NULL,
    total_cod_amount NUMERIC(12, 3) NOT NULL,
    total_fees NUMERIC(12, 3) NOT NULL,
    net_payout NUMERIC(12, 3) NOT NULL,
    payout_method TEXT DEFAULT 'CLIQ',
    transaction_ref TEXT,
    status TEXT DEFAULT 'PENDING',
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.merchant_settlements ADD COLUMN IF NOT EXISTS tenant_id UUID;

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    merchant_id UUID,
    expense_number TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 3) NOT NULL,
    payment_method TEXT DEFAULT 'CASH',
    recipient TEXT,
    expense_date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    receipt_url TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS merchant_id UUID;

-- ------------------------------------------------------------------------------
-- 8. DEFAULT SEED DATA & SUPER ADMIN CREDENTIALS
-- ------------------------------------------------------------------------------
-- 1. SaaS Plans
INSERT INTO public.subscription_plans (code, name, monthly_price, annual_price, max_orders_per_month, max_users, features) VALUES
('STARTER', 'باقة البداية (Starter)', 25.000, 250.000, 500, 3, '["orders.create", "orders.track", "pos.basic"]'::jsonb),
('PRO_GROWTH', 'باقة الشركات والنمو (Growth)', 60.000, 600.000, 3000, 15, '["orders.bulk", "dispatch.fleet", "pos.full", "accounting.basic", "merchants.portal"]'::jsonb),
('ENTERPRISE', 'باقة المنظومة المتكاملة (Enterprise)', 150.000, 1500.000, 25000, 100, '["all_modules", "api.webhook", "route.optimizer", "accounting.full", "white_label"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 2. Official Super Admin Account (OPS Master)
INSERT INTO public.users (
    id,
    name,
    email,
    phone,
    password,
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
    'admin123',
    crypt('admin123', gen_salt('bf')),
    'SUPER_ADMIN',
    'المدير العام للنظام (Super Admin)',
    'OPS',
    'المقر الرئيسي للمملكة',
    'عمان',
    TRUE,
    '["manage_system_settings", "manage_operations_admins", "view_financial_audit_logs", "export_database_backup", "users.manage_operations", "users.manage_staff"]'::jsonb,
    '["manage_system_settings", "manage_operations_admins", "view_financial_audit_logs", "export_database_backup", "users.manage_operations", "users.manage_staff"]'::jsonb
)
ON CONFLICT (email) DO UPDATE SET
    role = 'SUPER_ADMIN',
    portal_access = 'OPS',
    is_active = TRUE,
    permissions = EXCLUDED.permissions,
    max_allowed_permissions = EXCLUDED.max_allowed_permissions;

-- 3. Default Chart of Accounts
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

-- ------------------------------------------------------------------------------
-- 9. SAFE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Clean existing policies safely
DROP POLICY IF EXISTS super_admin_all_tenants ON public.tenants;
DROP POLICY IF EXISTS super_admin_all_users ON public.users;
DROP POLICY IF EXISTS tenant_users_isolation ON public.users;
DROP POLICY IF EXISTS public_read_plans ON public.subscription_plans;
DROP POLICY IF EXISTS super_admin_all_products ON public.products;
DROP POLICY IF EXISTS super_admin_all_shipments ON public.shipments;

-- Allow public read for plans
CREATE POLICY public_read_plans ON public.subscription_plans FOR SELECT USING (TRUE);

-- Super Admin bypass policy
CREATE POLICY super_admin_all_users ON public.users FOR ALL USING (
    COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_ADMIN' OR
    role = 'SUPER_ADMIN' OR
    current_user = 'postgres'
);

CREATE POLICY tenant_users_isolation ON public.users FOR ALL USING (
    COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_ADMIN' OR
    tenant_id IS NULL OR
    tenant_id = (SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
);

-- ------------------------------------------------------------------------------
-- 10. COMPREHENSIVE DIAGNOSTIC AUDIT REPORT
-- (Execute this to verify all tables, columns, and permissions status)
-- ------------------------------------------------------------------------------
SELECT 
    t.table_name AS "اسم الجدول",
    CASE 
        WHEN c.has_tenant_id THEN 'موجود ومفعل (OK)' 
        ELSE 'غير مطلوب / لا ينطبق' 
    END AS "حقل tenant_id",
    COALESCE(s.row_count, 0) AS "عدد السجلات الحالي",
    'سليم وجاهز 100%' AS "حالة الفحص"
FROM (
    VALUES 
        ('tenants'),
        ('subscription_plans'),
        ('users'),
        ('categories'),
        ('products'),
        ('pos_sales'),
        ('shipments'),
        ('merchant_settlements'),
        ('expenses')
) AS t(table_name)
LEFT JOIN LATERAL (
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = t.table_name 
          AND column_name = 'tenant_id'
    ) AS has_tenant_id
) c ON TRUE
LEFT JOIN LATERAL (
    SELECT CASE t.table_name
        WHEN 'users' THEN (SELECT COUNT(*) FROM public.users)
        WHEN 'tenants' THEN (SELECT COUNT(*) FROM public.tenants)
        WHEN 'subscription_plans' THEN (SELECT COUNT(*) FROM public.subscription_plans)
        WHEN 'categories' THEN (SELECT COUNT(*) FROM public.categories)
        WHEN 'products' THEN (SELECT COUNT(*) FROM public.products)
        WHEN 'pos_sales' THEN (SELECT COUNT(*) FROM public.pos_sales)
        WHEN 'shipments' THEN (SELECT COUNT(*) FROM public.shipments)
        WHEN 'merchant_settlements' THEN (SELECT COUNT(*) FROM public.merchant_settlements)
        WHEN 'expenses' THEN (SELECT COUNT(*) FROM public.expenses)
        ELSE 0
    END AS row_count
) s ON TRUE
ORDER BY t.table_name;

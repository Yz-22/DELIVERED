-- ==============================================================================
-- DarGo Logistics & Enterprise POS - Complete Production Database Schema
-- Optimized for PostgreSQL 14+ / Supabase
-- Multi-Tenant Isolation | Hierarchical RBAC | OPS Subdomain | Enterprise POS
-- Safe for both Fresh Installs and Existing Database Upgrades (Idempotent)
-- ==============================================================================

-- 1. EXTENSIONS & GLOBAL CONFIGURATION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TENANTS & SUBSCRIPTIONS
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

-- Idempotent upgrades for subscription_plans
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'JOD';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'MONTHLY';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS enabled_modules JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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

-- Real Subscriptions Engine Table (Phase 2)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    plan_id UUID,
    plan_code TEXT NOT NULL DEFAULT 'PROFESSIONAL',
    plan_name TEXT NOT NULL DEFAULT 'الباقة الذهبية للمحترفين (Gold Pro)',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    trial_start_date TIMESTAMPTZ,
    trial_end_date TIMESTAMPTZ,
    price NUMERIC(12, 3) NOT NULL DEFAULT 85.000,
    currency TEXT NOT NULL DEFAULT 'JOD',
    billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
    enabled_modules JSONB NOT NULL DEFAULT '{"tmsDelivery": true, "posCashier": true, "merchantWms": true, "accountingSettlements": true, "apiIntegrations": true, "aiRouteOptimizer": true}'::jsonb,
    max_users INTEGER NOT NULL DEFAULT 15,
    max_monthly_orders INTEGER NOT NULL DEFAULT 10000,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    suspended_reason TEXT,
    grace_period_days INTEGER NOT NULL DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON public.subscriptions(end_date);

INSERT INTO public.tenants (id, name, subdomain, subscription_status)
VALUES ('00000000-0000-0000-0000-000000000000', 'المؤسسة الافتراضية الرئيسية (Main Tenant)', 'default', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 3. USERS & HIERARCHICAL RBAC
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Idempotent Column Migrations for Users
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

UPDATE public.users 
SET tenant_id = '00000000-0000-0000-0000-000000000000' 
WHERE tenant_id IS NULL AND (role IS NULL OR role != 'SUPER_ADMIN');

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- 4. CATEGORIES & PRODUCTS
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

-- 5. POS CHECKOUT TRANSACTIONS
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

-- 6. SHIPMENTS & FLEET LOGISTICS
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

CREATE TABLE IF NOT EXISTS public.shipment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. DOUBLE-ENTRY ACCOUNTING & SETTLEMENTS
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

-- 8. DEFAULT PLANS & SUPER ADMIN SEED
INSERT INTO public.subscription_plans (code, name, monthly_price, annual_price, max_orders_per_month, max_users, features) VALUES
('STARTER', 'باقة البداية (Starter)', 25.000, 250.000, 500, 3, '["orders.create", "orders.track", "pos.basic"]'::jsonb),
('PRO_GROWTH', 'باقة الشركات والنمو (Growth)', 60.000, 600.000, 3000, 15, '["orders.bulk", "dispatch.fleet", "pos.full", "accounting.basic", "merchants.portal"]'::jsonb),
('ENTERPRISE', 'باقة المنظومة المتكاملة (Enterprise)', 150.000, 1500.000, 25000, 100, '["all_modules", "api.webhook", "route.optimizer", "accounting.full", "white_label"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

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

-- 9. SAFE ROW LEVEL SECURITY
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_plans ON public.subscription_plans;
DROP POLICY IF EXISTS super_admin_all_users ON public.users;
DROP POLICY IF EXISTS tenant_users_isolation ON public.users;

CREATE POLICY public_read_plans ON public.subscription_plans FOR SELECT USING (TRUE);

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

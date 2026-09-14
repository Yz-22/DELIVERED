-- ==============================================================================
-- DarGo Logistics & Enterprise POS - Complete Production Database Schema
-- Optimized for PostgreSQL 14+ / Supabase
-- Target Concurrency: 10,000+ Concurrent Active Users
-- Multi-Tier Hierarchical RBAC | Logistics TMS | Enterprise POS | Double-Entry Accounting
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
-- 2. USERS & HIERARCHICAL RBAC (الهرم الإداري والصلاحيات)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN (
        'SUPER_ADMIN',  -- المدير العام للمنصة (صلاحيات مطلقة وسقف الصلاحيات)
        'ADMIN',        -- مدير العمليات الرئيسي
        'OPERATOR',     -- مشرف عمليات / فرع / مستودع
        'MERCHANT',     -- تاجر / صاحب متجر
        'CASHIER',      -- كاشير مبيعات POS
        'ACCOUNTANT',   -- محاسب ومدخل قيود
        'DRIVER',       -- كابتن / مندوب توصيل
        'STAFF'         -- موظف تنفيذ
    )),
    role_name TEXT,
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
    
    -- Hierarchical RBAC Relationships
    parent_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- المدير المسؤول المباشر
    created_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- من قام بإنشاء الحساب
    
    -- Permissions Configuration (JSONB)
    permissions JSONB DEFAULT '[]'::jsonb NOT NULL,              -- الصلاحيات النشطة الممنوحة للمستخدم
    max_allowed_permissions JSONB DEFAULT '[]'::jsonb NOT NULL,  -- السقف الأعلى المسموح به من الإدارة العليا
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Fast Indexes for 10K User Load
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON public.users(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 3. CATEGORIES & TAXONOMY (التصنيفات المحفوظة للمتجر)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL means Global system default
    name TEXT NOT NULL,
    icon TEXT,
    is_system_default BOOLEAN DEFAULT FALSE NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (merchant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_merchant ON public.categories(merchant_id);

-- ==============================================================================
-- 4. PRODUCTS & WAREHOUSE INVENTORY (المنتجات والمستودع)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (merchant_id, sku),
    UNIQUE (merchant_id, barcode)
);

-- B-Tree Indexes for POS Barcode scanning in under 5ms
CREATE INDEX IF NOT EXISTS idx_products_merchant ON public.products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(merchant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(merchant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(merchant_id, category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(merchant_id, is_active);

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stock Movement Audit Log
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('PURCHASE', 'POS_SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT', 'TRANSFER')),
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    unit_cost NUMERIC(12, 3) DEFAULT 0.000,
    reference_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_tx_prod ON public.inventory_transactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_merchant ON public.inventory_transactions(merchant_id, created_at DESC);

-- ==============================================================================
-- 5. POS CASHIER & FAST CHECKOUT TRANSACTIONS (المبيعات ونقاط البيع)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pos_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_number TEXT UNIQUE NOT NULL, -- e.g. POS-2026-00001
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    cashier_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sale_type TEXT NOT NULL CHECK (sale_type IN ('IN_STORE', 'ONLINE_DELIVERY')),
    
    subtotal NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    discount_amount NUMERIC(12, 3) DEFAULT 0.000,
    delivery_fee NUMERIC(12, 3) DEFAULT 0.000,
    total NUMERIC(12, 3) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'VISA_MASTERCARD', 'CLIQ', 'SPLIT_PAYMENT')),
    
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    status TEXT DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VOIDED', 'REFUNDED')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

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
-- 6. SHIPMENTS & LOGISTICS FLEET (بوالص الشحن والتوصيل)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_number TEXT UNIQUE NOT NULL, -- e.g. ORD-2026-0001
    reference_number TEXT,
    merchant_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',           -- بانتظار الموافقة والاستلام
        'PICKING',           -- جاري الاستلام من المتجر
        'RECEIVED_AT_HUB',   -- تم الاستلام في مستودع الفرز المركزي
        'OUT_FOR_DELIVERY',  -- مع المندوب جاري التوصيل
        'POSTPONED',         -- مؤجل بناءً على طلب المستلم
        'CANCELLED',         -- ملغي قبل التسليم
        'DELIVERED',         -- تم التسليم بنجاح
        'RETURNED'           -- راجع / مرتجع للمتجر
    )),
    payment_type TEXT NOT NULL DEFAULT 'COD' CHECK (payment_type IN ('COD', 'CLIQ', 'PREPAID')),
    
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

-- Fast Indexing for Real-Time Fleet & Dispatch
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON public.shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_merchant_status ON public.shipments(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_driver_status ON public.shipments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_governorate ON public.shipments(governorate);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON public.shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_settlement_mer ON public.shipments(merchant_id, is_settled_with_merchant);
CREATE INDEX IF NOT EXISTS idx_shipments_settlement_drv ON public.shipments(driver_id, is_settled_with_driver);

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
-- 7. DOUBLE-ENTRY ACCOUNTING & SETTLEMENTS (المحاسبة والقيود المالية)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_number TEXT UNIQUE NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE NOT NULL,
    description TEXT NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    total_debit NUMERIC(12, 3) NOT NULL,
    total_credit NUMERIC(12, 3) NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_balanced_entry CHECK (total_debit = total_credit)
);

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

-- Merchant Financial Wallet Settlements
CREATE TABLE IF NOT EXISTS public.merchant_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_number TEXT UNIQUE NOT NULL,
    merchant_id UUID REFERENCES public.users(id) ON DELETE RESTRICT NOT NULL,
    total_cod_amount NUMERIC(12, 3) NOT NULL,
    total_fees NUMERIC(12, 3) NOT NULL,
    net_payout NUMERIC(12, 3) NOT NULL,
    payout_method TEXT DEFAULT 'CLIQ' CHECK (payout_method IN ('CLIQ', 'BANK_TRANSFER', 'CASH', 'CHEQUE')),
    transaction_ref TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'TRANSFERRED', 'CANCELLED')),
    processed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mer_settlements_merchant ON public.merchant_settlements(merchant_id, created_at DESC);

-- Expenses & Operating Costs (مصاريف التشغيل)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_expenses_merchant_date ON public.expenses(merchant_date DESC);

-- ==============================================================================
-- 8. INVOICES & BILLING (الفواتير والمطالبات التجارية)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('SALE', 'PURCHASE', 'RETURN')),
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
    payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID', 'OVERDUE')),
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_merchant ON public.invoices(merchant_id, issue_date DESC);

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

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- ==============================================================================
-- 9. ATOMIC STORED PROCEDURES (عالي الأداء لمنع القفل ومشاكل التزامن)
-- ==============================================================================

-- 9.1 Atomic POS Sale & Real-Time Stock Decrement
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
BEGIN
    -- 1. Insert POS Sale Record
    INSERT INTO public.pos_sales (
        sale_number, merchant_id, cashier_id, sale_type,
        subtotal, discount_amount, delivery_fee, total,
        payment_method, customer_name, customer_phone
    ) VALUES (
        p_sale_number, p_merchant_id, p_cashier_id, p_sale_type,
        p_subtotal, p_discount, p_delivery_fee, p_total,
        p_payment_method, p_customer_name, p_customer_phone
    ) RETURNING id INTO v_sale_id;

    -- 2. Process Items and update stock atomically
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INT;
        v_unit_price := (v_item->>'unit_price')::NUMERIC;
        v_cost_price := COALESCE((v_item->>'cost_price')::NUMERIC, 0.000);
        v_prod_name := v_item->>'name';

        -- Insert Line Item
        INSERT INTO public.pos_sale_items (
            sale_id, product_id, product_name, quantity, unit_price, total_price, cost_price
        ) VALUES (
            v_sale_id, v_product_id, v_prod_name, v_quantity, v_unit_price, (v_quantity * v_unit_price), v_cost_price
        );

        -- Decrement stock if product exists
        IF v_product_id IS NOT NULL THEN
            SELECT stock_quantity INTO v_curr_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
            
            UPDATE public.products
            SET stock_quantity = stock_quantity - v_quantity,
                updated_at = NOW()
            WHERE id = v_product_id;

            -- Log inventory movement
            INSERT INTO public.inventory_transactions (
                merchant_id, product_id, user_id, transaction_type,
                quantity, previous_stock, new_stock, unit_cost, reference_id, notes
            ) VALUES (
                p_merchant_id, v_product_id, p_cashier_id, 'POS_SALE',
                -v_quantity, v_curr_stock, (v_curr_stock - v_quantity), v_cost_price, p_sale_number, 'مبيعات كاشير فورية'
            );
        END IF;
    END LOOP;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES (أمان البيانات وعزل السجلات)
-- ==============================================================================
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

-- 10.1 Super Admin Access: Full Access to all rows
CREATE POLICY super_admin_users_all ON public.users FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');
CREATE POLICY super_admin_products_all ON public.products FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');
CREATE POLICY super_admin_shipments_all ON public.shipments FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');
CREATE POLICY super_admin_sales_all ON public.pos_sales FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');
CREATE POLICY super_admin_invoices_all ON public.invoices FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');

-- 10.2 Operations Admin / Merchant Access
CREATE POLICY merchant_products_isolation ON public.products FOR ALL USING (
    merchant_id = auth.uid() OR
    merchant_id = (SELECT parent_user_id FROM public.users WHERE id = auth.uid()) OR
    auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
);

CREATE POLICY merchant_shipments_isolation ON public.shipments FOR ALL USING (
    merchant_id = auth.uid() OR
    driver_id = auth.uid() OR
    auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
);

CREATE POLICY merchant_pos_isolation ON public.pos_sales FOR ALL USING (
    merchant_id = auth.uid() OR
    cashier_id = auth.uid() OR
    merchant_id = (SELECT parent_user_id FROM public.users WHERE id = auth.uid()) OR
    auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
);

-- 10.3 Categories Access
CREATE POLICY categories_public_view ON public.categories FOR SELECT USING (
    is_system_default = TRUE OR
    merchant_id = auth.uid() OR
    auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
);

-- ==============================================================================
-- 11. INITIAL SEED: CHART OF ACCOUNTS & SYSTEM DEFAULT CATEGORIES
-- ==============================================================================
INSERT INTO public.chart_of_accounts (code, name, type, description) VALUES
('1010', 'الصندوق والنقدية (Cash)', 'ASSET', 'النقدية المتوفرة في الكاشير والخزينة الرئيسية'),
('1020', 'الحساب البنكي و CliQ', 'ASSET', 'حسابات الدفع الإلكتروني والتحويل البنكي'),
('1030', 'ذمم كباتن التوصيل (Drivers COD)', 'ASSET', 'المبالغ النقدية المحصلة مع المناديب وبانتظار التوريد'),
('1040', 'المخزون السلعي (Inventory)', 'ASSET', 'قيمة بضاعة المستودع بسعر التكلفة'),
('2010', 'مستحقات التجار (Merchants Payables)', 'LIABILITY', 'صافي مستحقات المتاجر في المحفظة'),
('4010', 'إيرادات المبيعات (Sales Revenue)', 'REVENUE', 'إجمالي مبيعات المتجر ونقاط البيع POS'),
('4020', 'إيرادات التوصيل والشحن (Delivery Revenue)', 'REVENUE', 'رسوم شحن وتوصيل الطرود'),
('5010', 'تكلفة البضاعة المباعة (COGS)', 'EXPENSE', 'تكلفة المنتجات المباعة'),
('5020', 'عمولات السائقين والمناديب', 'EXPENSE', 'بدل توصيل للمناديب عن كل طرد'),
('5030', 'المصاريف التشغيلية والإيجارات', 'EXPENSE', 'مصاريف الفرع، رواتب، كهرباء، وصيانة')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.categories (merchant_id, name, is_system_default, display_order) VALUES
(NULL, 'ألبسة نسائية', TRUE, 1),
(NULL, 'عبايات وجلابيات', TRUE, 2),
(NULL, 'ألبسة رجالية', TRUE, 3),
(NULL, 'ألبسة أطفال', TRUE, 4),
(NULL, 'حقائب وأحذية', TRUE, 5),
(NULL, 'إكسسوارات', TRUE, 6),
(NULL, 'شالات وإيشاربات', TRUE, 7),
(NULL, 'عطور وتجميل', TRUE, 8),
(NULL, 'ساعات ومجوهرات', TRUE, 9),
(NULL, 'إلكترونيات وهواتف', TRUE, 10),
(NULL, 'أدوات منزلية', TRUE, 11),
(NULL, 'عام', TRUE, 12)
ON CONFLICT DO NOTHING;

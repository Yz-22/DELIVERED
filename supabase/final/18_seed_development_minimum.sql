-- ============================================================================
-- DELIVERE — 18_seed_development_minimum.sql
-- Clean Development Seed Fixtures (Safe Baseline Configuration)
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
    -- 1. Create Default Master Tenant
    INSERT INTO public.tenants (id, name, code, is_active, created_at, updated_at)
    VALUES (
        v_tenant_id,
        'شركة دليفري للخدمات اللوجستية (Delivere Express)',
        'DELIVERE-HQ',
        true,
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE 
    SET name = EXCLUDED.name, code = EXCLUDED.code;

    -- 2. Tenant Settings & Branding (Clean null placeholders for contact)
    INSERT INTO public.tenant_settings (
        tenant_id, company_name, commercial_name, brand_color, currency,
        phone, email, address, created_at, updated_at
    ) VALUES (
        v_tenant_id,
        'Delivere Express Logistics Inc.',
        'دليفري إكسبريس للخدمات اللوجستية والتوصيل',
        '#4F46E5',
        'JOD',
        NULL,
        NULL,
        NULL,
        now(),
        now()
    ) ON CONFLICT (tenant_id) DO UPDATE 
    SET company_name = EXCLUDED.company_name;

    -- 3. Subscription Master Plans
    INSERT INTO public.subscription_plans (
        id, code, name_ar, name_en, monthly_price_jod, annual_price_jod,
        max_users, max_monthly_orders, enabled_modules, is_active, is_public
    ) VALUES 
    ('plan-starter', 'STARTER', 'الباقة الأساسية', 'Starter Plan', 0.000, 0.000, 5, 500, '{"tmsDelivery":true,"posCashier":true,"merchantWms":false,"accountingSettlements":true}'::jsonb, true, true),
    ('plan-growth', 'GROWTH', 'الباقة المتقدمة', 'Growth Plan', 45.000, 450.000, 20, 3000, '{"tmsDelivery":true,"posCashier":true,"merchantWms":true,"accountingSettlements":true}'::jsonb, true, true),
    ('plan-enterprise', 'ENTERPRISE', 'باقة الشركات الكبرى', 'Enterprise Plan', 95.000, 950.000, 100, 50000, '{"tmsDelivery":true,"posCashier":true,"merchantWms":true,"accountingSettlements":true,"aiRouteOptimizer":true,"apiIntegrations":true}'::jsonb, true, true)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Active Subscription for Master Tenant
    INSERT INTO public.subscriptions (
        id, tenant_id, plan_id, plan_code, plan_name, status,
        start_date, end_date, price, currency, billing_cycle,
        enabled_modules, max_users, max_monthly_orders, auto_renew
    ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'plan-enterprise',
        'ENTERPRISE',
        'باقة الشركات الكبرى',
        'ACTIVE',
        now(),
        now() + interval '365 days',
        95.000,
        'JOD',
        'ANNUAL',
        '{"tmsDelivery":true,"posCashier":true,"merchantWms":true,"accountingSettlements":true,"aiRouteOptimizer":true,"apiIntegrations":true}'::jsonb,
        100,
        50000,
        true
    ) ON CONFLICT DO NOTHING;

    -- 5. Default Standard Chart of Accounts (COA)
    INSERT INTO public.accounts (tenant_id, code, name, name_ar, type, description, is_system)
    VALUES 
    (v_tenant_id, '1010', 'Main Cash on Hand', 'الصندوق النقدي الرئيسي', 'ASSET', 'النقدية المتوفرة في الخزينة الرئيسية', true),
    (v_tenant_id, '1020', 'Driver Cash Custody', 'أمانات الكباتن النقدية', 'ASSET', 'النقدية المقبوضة فعلياً تحت عهدة السائقين', true),
    (v_tenant_id, '1030', 'Central Bank & CliQ', 'الحساب البنكي وخدمة كليك', 'ASSET', 'التحصيلات الإلكترونية المركزية', true),
    (v_tenant_id, '1070', 'Merchant Accounts Receivable', 'ذمم المتاجر المدينة', 'ASSET', 'مستحقات التوصيل الآجلة على المتاجر', true),
    (v_tenant_id, '1200', 'Inventory Asset', 'أصول المخزون السلعي', 'ASSET', 'قيمة البضائع والمخزون في الفروع والمستودعات', true),
    (v_tenant_id, '2020', 'Merchant COD Payables', 'أمانات تحصيل المتاجر الدائنة', 'LIABILITY', 'أمانات بضائع المتاجر المحصلة من الزبائن الواجب تسديدها', true),
    (v_tenant_id, '2030', 'Driver Earnings Payable', 'أتعاب وأجور الكباتن المستحقة', 'LIABILITY', 'عمولات وأتعاب التوصيل المستحقة للسائقين', true),
    (v_tenant_id, '2050', 'Accounts Payable', 'ذمم الموردين والشركاء الدائنة', 'LIABILITY', 'الالتزامات التجارية العامة', true),
    (v_tenant_id, '4010', 'Delivery Tariff Revenue', 'إيرادات خدمات التوصيل', 'REVENUE', 'أجور التوصيل الصافية المحققة لشركة اللوجستيات', true),
    (v_tenant_id, '4020', 'Merchant Sales Revenue', 'إيرادات مبيعات المتاجر', 'REVENUE', 'إيرادات نقاط البيع والمبيعات المباشرة', true),
    (v_tenant_id, '5010', 'Driver Delivery Expense', 'مصاريف أتعاب التوصيل', 'EXPENSE', 'تكلفة التوصيل المباشرة المدفوعة للكباتن', true),
    (v_tenant_id, '5020', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة (COGS)', 'EXPENSE', 'تكلفة المنتجات المباعة', true)
    ON CONFLICT (tenant_id, code) DO NOTHING;

    -- 6. Default Canonical Price Plans (Strict Delivere Business Rules)
    -- Standard Merchant Tariff
    INSERT INTO public.price_plans (
        id, tenant_id, name, type, description, is_default, default_fee,
        governorate_fees, return_fee, extra_weight_fee_per_kg, is_active
    ) VALUES (
        'pp-mer-std',
        v_tenant_id,
        'جميع المملكة 2 (القياسية)',
        'MERCHANT',
        'قائمة أسعار التوصيل المعتمدة للمتاجر: عمان 2.000 / 3.000 د.أ، وباقي المحافظات حسب التعرفة المعتمدة',
        true,
        3.000,
        '{"عمان": 2.000, "الزرقاء": 2.500, "البلقاء": 3.000, "السلط (البلقاء)": 3.000, "مادبا": 3.000, "إربد": 3.000, "جرش": 3.000, "عجلون": 3.000, "المفرق": 3.000, "الكرك": 3.500, "الطفيلة": 3.500, "معان": 4.000, "العقبة": 4.000}'::jsonb,
        1.500,
        0.500,
        true
    ) ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        default_fee = EXCLUDED.default_fee,
        governorate_fees = EXCLUDED.governorate_fees,
        return_fee = EXCLUDED.return_fee,
        extra_weight_fee_per_kg = EXCLUDED.extra_weight_fee_per_kg,
        is_active = true;

    -- Standard Driver Compensation
    INSERT INTO public.price_plans (
        id, tenant_id, name, type, description, is_default, default_fee,
        governorate_fees, return_fee, extra_weight_fee_per_kg, is_active
    ) VALUES (
        'pp-drv-std',
        v_tenant_id,
        'تعرفة أتعاب الكباتن القياسية (Standard Driver Compensation)',
        'DRIVER',
        'التعرفة المعتمدة لحساب أتعاب توصيل الكباتن: عمان 1.500، الزرقاء 1.750، وباقي المحافظات حسب التعرفة',
        true,
        1.500,
        '{"عمان": 1.500, "الزرقاء": 1.750, "البلقاء": 2.000, "السلط (البلقاء)": 2.000, "مادبا": 2.000, "إربد": 2.000, "جرش": 2.000, "عجلون": 2.000, "المفرق": 2.000, "الكرك": 2.500, "الطفيلة": 2.500, "معان": 3.000, "العقبة": 3.000}'::jsonb,
        0.500,
        0.250,
        true
    ) ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        default_fee = EXCLUDED.default_fee,
        governorate_fees = EXCLUDED.governorate_fees,
        return_fee = EXCLUDED.return_fee,
        extra_weight_fee_per_kg = EXCLUDED.extra_weight_fee_per_kg,
        is_active = true;

    -- Standard Origin/Destination Rules for Amman & Major Hubs
    INSERT INTO public.price_plan_rules (
        tenant_id, price_plan_id, from_governorate, from_sub_region, to_governorate, to_sub_region, order_type, price, return_discount, fixed_return, driver_discount, fixed_driver_cost, is_active
    ) VALUES
    (v_tenant_id, 'pp-mer-std', 'عمان', 'وسط البلد', 'عمان', 'شمال عمان', 'عادي', 2.000, 0.000, 1.000, 0.000, 1.500, true),
    (v_tenant_id, 'pp-mer-std', 'عمان', 'وسط البلد', 'الزرقاء', 'الزرقاء الجديدة', 'عادي', 2.500, 0.000, 1.250, 0.000, 1.750, true),
    (v_tenant_id, 'pp-mer-std', 'عمان', 'وسط البلد', 'إربد', 'الحي الشرقي', 'عادي', 3.000, 0.000, 1.500, 0.000, 2.000, true)
    ON CONFLICT DO NOTHING;

    -- NOTE: No fake human credentials or plaintext passwords are seeded.
    -- The Super Admin connects dynamically via Google OAuth / Supabase Auth Onboarding.

    RAISE NOTICE 'Development minimum seed data (system config, COA, plans) loaded successfully.';
END $$;

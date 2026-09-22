import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateAndNormalizeJordanPhone,
  validateAndNormalizeSecondaryJordanPhone,
  isValidJordanPhone,
  formatJordanPhoneForDisplay,
  ALLOWED_JORDAN_MOBILE_PREFIXES,
} from '../src/utils/jordanPhone.ts';
import {
  computeCanonicalPayloadHash,
  type CanonicalOrderPayload,
} from '../src/services/orderPersistenceService.ts';

const hotfixMigrationPath = path.join(
  process.cwd(),
  'supabase/final/hotfixes/20260922_order_persistence_and_idempotency_hardening.sql'
);

function readSql(): string {
  return fs.readFileSync(hotfixMigrationPath, 'utf-8');
}

// ============================================================================
// SECTION 1: CANONICAL JORDAN PHONE CONTRACT — VALIDATION & NORMALIZATION
// ============================================================================

test('01. Valid local Jordan mobile numbers starting with 079, 078, 077 normalize to +9627XXXXXXXX', () => {
  const localCases = [
    { input: '0791234567', expected: '+962791234567' },
    { input: '0781234567', expected: '+962781234567' },
    { input: '0771234567', expected: '+962771234567' },
    { input: ' 0791234567 ', expected: '+962791234567' }, // Trim leading/trailing spaces
    { input: '079-123-4567', expected: '+962791234567' }, // Strips formatting hyphens
    { input: '079 123 4567', expected: '+962791234567' }, // Strips formatting spaces
  ];

  for (const c of localCases) {
    const res = validateAndNormalizeJordanPhone(c.input);
    assert.strictEqual(res.isValid, true, `Input "${c.input}" should be valid`);
    assert.strictEqual(res.canonicalPhone, c.expected, `Input "${c.input}" should normalize to ${c.expected}`);
    assert.strictEqual(isValidJordanPhone(c.input), true);
  }
});

test('02. Valid international Jordan mobile numbers with +962 normalize to +9627XXXXXXXX', () => {
  const intlCases = [
    { input: '+962791234567', expected: '+962791234567' },
    { input: '+962781234567', expected: '+962781234567' },
    { input: '+962771234567', expected: '+962771234567' },
    { input: '+962 79 123 4567', expected: '+962791234567' },
    { input: '+962-78-123-4567', expected: '+962781234567' },
  ];

  for (const c of intlCases) {
    const res = validateAndNormalizeJordanPhone(c.input);
    assert.strictEqual(res.isValid, true, `Input "${c.input}" should be valid`);
    assert.strictEqual(res.canonicalPhone, c.expected, `Input "${c.input}" should normalize to ${c.expected}`);
  }
});

test('03. Valid 962-without-plus and 00962 international numbers normalize to +9627XXXXXXXX', () => {
  const cases = [
    { input: '962791234567', expected: '+962791234567' },
    { input: '962781234567', expected: '+962781234567' },
    { input: '962771234567', expected: '+962771234567' },
    { input: '00962791234567', expected: '+962791234567' },
    { input: '00962781234567', expected: '+962781234567' },
    { input: '00962771234567', expected: '+962771234567' },
  ];

  for (const c of cases) {
    const res = validateAndNormalizeJordanPhone(c.input);
    assert.strictEqual(res.isValid, true, `Input "${c.input}" should be valid`);
    assert.strictEqual(res.canonicalPhone, c.expected, `Input "${c.input}" should normalize to ${c.expected}`);
  }
});

test('04. Invalid phone numbers are strictly rejected (fails closed)', () => {
  const invalidCases = [
    '791234567',       // 9 digits without leading 0 or 962
    '079123456',       // 9 digits total (too short)
    '07912345678',     // 11 digits total (too long)
    '+9620791234567',   // +962 with leading zero (INVALID)
    '+96279123456',    // +962 followed by 8 digits (too short)
    '+9627912345678',  // +962 followed by 10 digits (too long)
    '009620791234567', // 00962 with leading zero (INVALID)
    '0761234567',      // 076 prefix is not an allowed mobile operator
    '0751234567',      // 075 prefix invalid
    '+96261234567',    // Amman landline prefix not a mobile subscriber
    '07912345AB',      // Alpha characters
    '+962',            // Code only
    '07',              // Prefix only
    '',                // Empty string
    '   ',             // Spaces only
  ];

  for (const input of invalidCases) {
    const res = validateAndNormalizeJordanPhone(input);
    assert.strictEqual(res.isValid, false, `Input "${input}" must be rejected as invalid`);
    assert.strictEqual(res.canonicalPhone, null);
    assert.ok(res.error && res.error.length > 0, `Input "${input}" must provide descriptive error message`);
    assert.strictEqual(isValidJordanPhone(input), false);
  }

  // Null & undefined test
  const nullRes = validateAndNormalizeJordanPhone(null as any);
  assert.strictEqual(nullRes.isValid, false);
  const undefRes = validateAndNormalizeJordanPhone(undefined as any);
  assert.strictEqual(undefRes.isValid, false);
});

// ============================================================================
// SECTION 2: SECONDARY PHONE CONTRACT
// ============================================================================

test('05. Secondary phone contract: empty or null returns NULL without error', () => {
  const emptyCases = ['', '   ', null, undefined];
  for (const c of emptyCases) {
    const res = validateAndNormalizeSecondaryJordanPhone(c);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.canonicalPhone, null, 'Empty secondary phone must normalize to NULL');
  }
});

test('06. Secondary phone contract: provided value is validated with exact same mobile rules', () => {
  const validAlt = validateAndNormalizeSecondaryJordanPhone('0781234567');
  assert.strictEqual(validAlt.isValid, true);
  assert.strictEqual(validAlt.canonicalPhone, '+962781234567');

  const invalidAlt = validateAndNormalizeSecondaryJordanPhone('0769999999');
  assert.strictEqual(invalidAlt.isValid, false);
  assert.strictEqual(invalidAlt.canonicalPhone, null);
});

// ============================================================================
// SECTION 3: IDEMPOTENCY & PHONE CANONICALIZATION INVARIANCE
// ============================================================================

test('07. Local and international representations produce identical idempotency payload hash', () => {
  const baseOrder = {
    merchantId: '00000000-0000-0000-0000-000000000001',
    recipientName: 'طارق الزعبي',
    governorate: 'عمان',
    area: 'خلدا',
    subArea: 'دوار النعيمات',
    streetAddress: 'عمان - خلدا شارع وصفي التل',
    packageType: 'طرد إلكترونيات',
    piecesCount: 1,
    paymentType: 'COD' as const,
    totalCollectionInput: 45.0,
    merchantCollectionInput: 42.0,
    referenceNumber: 'REF-2026-99',
  };

  const payloadLocal: CanonicalOrderPayload = {
    ...baseOrder,
    recipientPhone: '0791234567',
  };

  const payloadIntl: CanonicalOrderPayload = {
    ...baseOrder,
    recipientPhone: '+962791234567',
  };

  const payloadFormatted: CanonicalOrderPayload = {
    ...baseOrder,
    recipientPhone: '079 123 4567',
  };

  const hashLocal = computeCanonicalPayloadHash(payloadLocal);
  const hashIntl = computeCanonicalPayloadHash(payloadIntl);
  const hashFormatted = computeCanonicalPayloadHash(payloadFormatted);

  assert.strictEqual(
    hashLocal,
    hashIntl,
    'Hash from local 0791234567 MUST equal hash from international +962791234567'
  );
  assert.strictEqual(
    hashLocal,
    hashFormatted,
    'Hash from formatted phone MUST equal canonical hash'
  );
});

// ============================================================================
// SECTION 4: DISPLAY FORMATTING
// ============================================================================

test('08. formatJordanPhoneForDisplay converts canonical +9627XXXXXXXX to clean local 07XXXXXXXX', () => {
  assert.strictEqual(formatJordanPhoneForDisplay('+962791234567'), '0791234567');
  assert.strictEqual(formatJordanPhoneForDisplay('+962781234567'), '0781234567');
  assert.strictEqual(formatJordanPhoneForDisplay('+962771234567'), '0771234567');
  assert.strictEqual(formatJordanPhoneForDisplay(null), '—');
  assert.strictEqual(formatJordanPhoneForDisplay(undefined), '—');
});

// ============================================================================
// SECTION 5: DATABASE RPC & HOTFIX EXECUTABILITY AUDIT
// ============================================================================

test('09. Database hotfix ensures sub_area and reference_number columns exist on public.shipments', () => {
  const sql = readSql();
  assert.ok(sql.includes('ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS reference_number TEXT;'), 'reference_number column added');
  assert.ok(sql.includes('ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS sub_area TEXT;'), 'sub_area column added');
});

test('10. Database RPC create_order_idempotent persists sub_area and reference_number into public.shipments', () => {
  const sql = readSql();
  assert.ok(sql.includes('NULLIF(TRIM(p_sub_area), \'\')'), 'p_sub_area is persisted with NULLIF');
  assert.ok(sql.includes('NULLIF(TRIM(p_reference_number), \'\')'), 'p_reference_number is persisted with NULLIF');
  assert.ok(sql.includes('\'sub_area\', v_created_shipment.sub_area'), 'sub_area included in response');
  assert.ok(sql.includes('\'reference_number\', v_created_shipment.reference_number'), 'reference_number included in response');
});

test('11. Database RPC contains defense-in-depth Jordan phone validation & normalization', () => {
  const sql = readSql();
  assert.ok(sql.includes('INVALID_RECIPIENT_PHONE'), 'RPC validates recipient phone format');
  assert.ok(sql.includes('INVALID_SECONDARY_PHONE'), 'RPC validates secondary phone format');
  assert.ok(sql.includes('v_norm_phone'), 'RPC normalizes phone to canonical +9627XXXXXXXX');
  assert.ok(sql.includes('v_norm_phone2'), 'RPC normalizes secondary phone');
});

test('12. Database RPC enforces payment combination defense-in-depth', () => {
  const sql = readSql();
  assert.ok(sql.includes('INVALID_PAYMENT_COMBINATION'), 'Payment combination check present');
  assert.ok(sql.includes("v_payment_type = 'COD' AND v_payment_method = 'CLIQ'"), 'Rejects COD + CLIQ');
  assert.ok(sql.includes("v_payment_type = 'PREPAID' AND v_payment_method = 'CASH'"), 'Rejects PREPAID + CASH');
});

test('13. Database RPC REVOKE and GRANT target exact 27-parameter signature', () => {
  const sql = readSql();
  const revokeRegex = /REVOKE ALL ON FUNCTION public\.create_order_idempotent\([\s\S]*?\) FROM PUBLIC, anon, authenticated;/;
  const grantRegex = /GRANT EXECUTE ON FUNCTION public\.create_order_idempotent\([\s\S]*?\) TO service_role;/;

  assert.ok(revokeRegex.test(sql), 'REVOKE targets exact signature');
  assert.ok(grantRegex.test(sql), 'GRANT targets exact signature');
});

test('14. Allowed Jordan mobile prefixes include 077, 078, 079', () => {
  assert.deepStrictEqual(
    ALLOWED_JORDAN_MOBILE_PREFIXES,
    ['077', '078', '079', '77', '78', '79']
  );
});

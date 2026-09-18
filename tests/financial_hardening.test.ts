import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toFils,
  fromFils,
  roundFils3,
  validateAndBuildDeliveryPosting,
} from '../server.ts';

test('1. Standard COD Flow Math & Balanced Journal Posting', () => {
  const order = {
    id: 'ord-test-cod-01',
    sequence: 'DEL-2026-001',
    paymentType: 'COD' as const,
    totalCollection: 38.000,     // Gross collection from customer
    merchantCollection: 35.000,  // Merchandise amount owed to merchant
    deliveryFee: 3.000,          // Delivere delivery fee
    driverFee: 1.500,
  };

  const result = validateAndBuildDeliveryPosting({ order });

  assert.equal(result.isValid, true, 'COD posting should be valid');
  assert.equal(result.status, 'POSTABLE');
  assert.equal(result.lines.length, 3);

  // DR 1020 (Driver Cash Custody) = 38.000
  const driverCustodyLine = result.lines.find((l) => l.accountCode === '1020');
  assert.ok(driverCustodyLine);
  assert.equal(driverCustodyLine.debit, 38.000);
  assert.equal(driverCustodyLine.credit, 0);

  // CR 2020 (Merchant Payables) = 35.000
  const merchPayableLine = result.lines.find((l) => l.accountCode === '2020');
  assert.ok(merchPayableLine);
  assert.equal(merchPayableLine.debit, 0);
  assert.equal(merchPayableLine.credit, 35.000);

  // CR 4010 (Delivery Revenue) = 3.000
  const deliveryRevLine = result.lines.find((l) => l.accountCode === '4010');
  assert.ok(deliveryRevLine);
  assert.equal(deliveryRevLine.debit, 0);
  assert.equal(deliveryRevLine.credit, 3.000);

  // Double-entry debit equals credit
  assert.equal(result.totalDebit, 38.000);
  assert.equal(result.totalCredit, 38.000);
});

test('2. CLIQ Flow: Driver Cash Custody is Strictly 0, Central Bank Debited', () => {
  const order = {
    id: 'ord-test-cliq-01',
    sequence: 'DEL-2026-002',
    paymentType: 'CLIQ' as const,
    totalCollection: 50.000,
    merchantCollection: 46.500,
    deliveryFee: 3.500,
    driverFee: 1.750,
  };

  const result = validateAndBuildDeliveryPosting({ order });

  assert.equal(result.isValid, true);
  assert.equal(result.status, 'POSTABLE');

  // Verify Driver Custody (1020) is NOT in lines
  const driverCustodyLine = result.lines.find((l) => l.accountCode === '1020');
  assert.equal(driverCustodyLine, undefined, 'Driver custody should be zero / absent for CLIQ');

  // DR 1030 (Bank / CliQ Account) = 50.000
  const bankLine = result.lines.find((l) => l.accountCode === '1030');
  assert.ok(bankLine);
  assert.equal(bankLine.debit, 50.000);
  assert.equal(bankLine.credit, 0);

  // CR 2020 (Merchant Payables) = 46.500
  const merchLine = result.lines.find((l) => l.accountCode === '2020');
  assert.ok(merchLine);
  assert.equal(merchLine.credit, 46.500);

  // CR 4010 (Delivery Revenue) = 3.500
  const revenueLine = result.lines.find((l) => l.accountCode === '4010');
  assert.ok(revenueLine);
  assert.equal(revenueLine.credit, 3.500);

  assert.equal(result.totalDebit, 50.000);
  assert.equal(result.totalCredit, 50.000);
});

test('3. PREPAID Flow: Driver Custody 0, Merchant COD 0, Merchant AR Debited', () => {
  const order = {
    id: 'ord-test-prepaid-01',
    sequence: 'DEL-2026-003',
    paymentType: 'PREPAID' as const,
    totalCollection: 0.000,
    merchantCollection: 0.000,
    deliveryFee: 3.000,
    driverFee: 1.500,
  };

  const result = validateAndBuildDeliveryPosting({ order });

  assert.equal(result.isValid, true);
  assert.equal(result.status, 'POSTABLE');

  // DR 1070 (Merchant AR) = 3.000
  const arLine = result.lines.find((l) => l.accountCode === '1070');
  assert.ok(arLine);
  assert.equal(arLine.debit, 3.000);
  assert.equal(arLine.credit, 0);

  // CR 4010 (Delivery Revenue) = 3.000
  const revLine = result.lines.find((l) => l.accountCode === '4010');
  assert.ok(revLine);
  assert.equal(revLine.debit, 0);
  assert.equal(revLine.credit, 3.000);

  // Neither 1020 (driver custody) nor 2020 (merchant payable) should exist
  assert.equal(result.lines.find((l) => l.accountCode === '1020'), undefined);
  assert.equal(result.lines.find((l) => l.accountCode === '2020'), undefined);

  assert.equal(result.totalDebit, 3.000);
  assert.equal(result.totalCredit, 3.000);
});

test('4. Corrupt COD Math Flags FINANCIAL_RECONCILIATION_REQUIRED', () => {
  const badOrder = {
    id: 'ord-bad-01',
    sequence: 'DEL-BAD-01',
    paymentType: 'COD' as const,
    totalCollection: 38.000,
    merchantCollection: 30.000, // Should be 35.000
    deliveryFee: 3.000,         // Sum is 33.000 != 38.000
  };

  const result = validateAndBuildDeliveryPosting({ order: badOrder });

  assert.equal(result.isValid, false);
  assert.equal(result.status, 'FINANCIAL_RECONCILIATION_REQUIRED');
  assert.ok(result.reason?.includes('COD equation mismatch'));
  assert.equal(result.lines.length, 0);
});

test('5. Exact JOD 3-Decimal Precision Arithmetic', () => {
  // Classic IEEE-754 precision trap: 0.1 + 0.2 = 0.30000000000000004
  const a = 0.100;
  const b = 0.200;
  const sumFils = toFils(a) + toFils(b);
  assert.equal(sumFils, 300);
  assert.equal(fromFils(sumFils), 0.300);

  // Three decimals precision
  const fee1 = 1.125;
  const fee2 = 2.375;
  const totalFils = toFils(fee1) + toFils(fee2);
  assert.equal(totalFils, 3500);
  assert.equal(fromFils(totalFils), 3.500);

  assert.equal(roundFils3(35.1234), 35.123);
  assert.equal(roundFils3(35.1236), 35.124);
});

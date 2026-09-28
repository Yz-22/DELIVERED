import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const driverPortalCode = fs.readFileSync(path.join(process.cwd(), 'src/components/DriverPortal.tsx'), 'utf-8');
const cameraScannerCode = fs.readFileSync(path.join(process.cwd(), 'src/components/CameraBarcodeScanner.tsx'), 'utf-8');

test('Phase 2C: DriverPortal imports and wires CameraBarcodeScanner for pickup and delivery', () => {
  assert.ok(driverPortalCode.includes("import { CameraBarcodeScanner } from './CameraBarcodeScanner'"), 'DriverPortal must import CameraBarcodeScanner');
  assert.ok(driverPortalCode.includes('handlePickupScan'), 'DriverPortal must define handlePickupScan');
  assert.ok(driverPortalCode.includes('handleDeliveryBarcodeScan'), 'DriverPortal must define handleDeliveryBarcodeScan');
  assert.ok(driverPortalCode.includes('deliveryBarcodeVerified'), 'DriverPortal must track deliveryBarcodeVerified state');
});

test('Phase 2C: Driver delivery requires barcode scan verification before completing delivery', () => {
  assert.ok(driverPortalCode.includes('!deliveryBarcodeVerified'), 'handleConfirmDelivery must enforce deliveryBarcodeVerified check');
  assert.ok(driverPortalCode.includes('إلزامي: يجب مسح باركود الشحنة بالكاميرا للتحقق من مطابقة الطرد قبل التسليم'), 'Must display mandatory barcode scan error if unverified');
});

test('Phase 2C: CameraBarcodeScanner includes duplicate scan debouncer and camera track cleanup', () => {
  assert.ok(cameraScannerCode.includes('lastScannedTimeRef'), 'CameraBarcodeScanner must implement lastScannedTimeRef for debouncing');
  assert.ok(cameraScannerCode.includes('facingMode: \'environment\''), 'CameraBarcodeScanner must request environment facingMode by default');
  assert.ok(cameraScannerCode.includes('html5QrCodeRef.current.stop()'), 'CameraBarcodeScanner must stop camera track on unmount');
});

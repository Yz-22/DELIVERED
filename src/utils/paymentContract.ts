export type CanonicalPaymentType = 'COD' | 'PREPAID' | 'POSTPAID';
export type CanonicalPaymentMethod = 'CASH' | 'CLIQ' | 'UNSPECIFIED';

export interface PaymentNormalizationSuccess {
  success: true;
  paymentType: CanonicalPaymentType;
  paymentMethod: CanonicalPaymentMethod;
  cliqReference: string | null;
  error?: undefined;
  code?: undefined;
  field?: undefined;
  status?: undefined;
}

export interface PaymentNormalizationFailure {
  success: false;
  paymentType?: undefined;
  paymentMethod?: undefined;
  cliqReference?: undefined;
  error: string;
  code: string;
  field: 'paymentType' | 'paymentMethod' | 'cliqReference';
  status: number;
}

export type PaymentNormalizationResult =
  | PaymentNormalizationSuccess
  | PaymentNormalizationFailure;

/**
 * Validates and normalizes order creation payment contract according to
 * the authoritative database schema and RPC rules.
 *
 * Allowed Pairs:
 * - COD + CASH
 * - PREPAID + CLIQ
 * - PREPAID + UNSPECIFIED
 * - POSTPAID + UNSPECIFIED
 *
 * Defaulting (when paymentMethod omitted):
 * - COD      -> CASH
 * - PREPAID  -> UNSPECIFIED
 * - POSTPAID -> UNSPECIFIED
 *
 * CliQ Reference:
 * - Retained strictly for PREPAID + CLIQ
 * - NULL for all other combinations
 * - Does not claim automated provider verification
 */
export function validateAndNormalizePaymentContract(input: {
  paymentType?: any;
  paymentMethod?: any;
  cliqReference?: any;
}): PaymentNormalizationResult {
  // 1. Normalize Payment Type
  let rawType = input.paymentType;
  let normalizedType: CanonicalPaymentType;

  if (rawType === undefined || rawType === null || String(rawType).trim() === '') {
    normalizedType = 'COD';
  } else {
    const trimmedType = String(rawType).trim().toUpperCase();
    if (trimmedType === 'COD') {
      normalizedType = 'COD';
    } else if (trimmedType === 'PREPAID') {
      normalizedType = 'PREPAID';
    } else if (trimmedType === 'POSTPAID') {
      normalizedType = 'POSTPAID';
    } else {
      return {
        success: false,
        error: `نوع الدفع '${String(rawType)}' غير صالح. الأنواع المعتمدة حصراً: COD, PREPAID, POSTPAID`,
        code: 'INVALID_PAYMENT_TYPE',
        field: 'paymentType',
        status: 400,
      };
    }
  }

  // 2. Normalize Payment Method
  let rawMethod = input.paymentMethod;
  let normalizedMethod: CanonicalPaymentMethod;

  if (rawMethod === undefined || rawMethod === null || String(rawMethod).trim() === '') {
    // paymentMethod omitted: apply authoritative defaults based on paymentType
    if (normalizedType === 'COD') {
      normalizedMethod = 'CASH';
    } else if (normalizedType === 'PREPAID') {
      normalizedMethod = 'UNSPECIFIED';
    } else {
      // POSTPAID
      normalizedMethod = 'UNSPECIFIED';
    }
  } else {
    // paymentMethod explicitly supplied: normalize and validate
    const trimmedMethod = String(rawMethod).trim().toUpperCase();
    if (trimmedMethod === 'CASH') {
      normalizedMethod = 'CASH';
    } else if (trimmedMethod === 'CLIQ') {
      normalizedMethod = 'CLIQ';
    } else if (trimmedMethod === 'UNSPECIFIED') {
      normalizedMethod = 'UNSPECIFIED';
    } else {
      return {
        success: false,
        error: `طريقة الدفع '${String(rawMethod)}' غير صالحة. الطرق المعتمدة حصراً: CASH, CLIQ, UNSPECIFIED`,
        code: 'INVALID_PAYMENT_METHOD',
        field: 'paymentMethod',
        status: 400,
      };
    }
  }

  // 3. Strict Allowed Pair Invariant Check
  // Allowed pairs ONLY:
  // - COD + CASH
  // - PREPAID + CLIQ
  // - PREPAID + UNSPECIFIED
  // - POSTPAID + UNSPECIFIED
  const isAllowed =
    (normalizedType === 'COD' && normalizedMethod === 'CASH') ||
    (normalizedType === 'PREPAID' && normalizedMethod === 'CLIQ') ||
    (normalizedType === 'PREPAID' && normalizedMethod === 'UNSPECIFIED') ||
    (normalizedType === 'POSTPAID' && normalizedMethod === 'UNSPECIFIED');

  if (!isAllowed) {
    return {
      success: false,
      error: `مزيج نوع وطريقة الدفع غير مسموح به (${normalizedType} + ${normalizedMethod}). الثنائيات المسموحة حصراً: COD+CASH, PREPAID+CLIQ, PREPAID+UNSPECIFIED, POSTPAID+UNSPECIFIED`,
      code: 'INVALID_PAYMENT_COMBINATION',
      field: 'paymentMethod',
      status: 400,
    };
  }

  // 4. CliQ Reference Handling
  // - Retained strictly for PREPAID + CLIQ
  // - NULL otherwise
  let finalCliqReference: string | null = null;
  if (normalizedType === 'PREPAID' && normalizedMethod === 'CLIQ') {
    if (input.cliqReference !== undefined && input.cliqReference !== null) {
      const trimmedRef = String(input.cliqReference).trim();
      finalCliqReference = trimmedRef.length > 0 ? trimmedRef : null;
    }
  }

  return {
    success: true,
    paymentType: normalizedType,
    paymentMethod: normalizedMethod,
    cliqReference: finalCliqReference,
  };
}

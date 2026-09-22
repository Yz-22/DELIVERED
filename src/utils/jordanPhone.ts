/**
 * DELIVERE ENTERPRISE — CANONICAL JORDAN PHONE CONTRACT
 *
 * Enforces authoritative Jordanian mobile phone validation, normalization, and canonical formatting.
 *
 * Canonical Rules:
 * - Allowed Mobile Operators / Prefixes: 077 (Orange), 078 (Umniah), 079 (Zain)
 * - Local Format: 07[789]XXXXXXX (Exactly 10 digits)
 * - International Format: +9627[789]XXXXXXX (Country code + 9 subscriber digits, NO leading zero after +962)
 * - Supported Un-prefixed International: 9627[789]XXXXXXX (Exactly 12 digits)
 * - Canonical Storage Format: +9627XXXXXXXX (e.g. +962791234567)
 */

export const ALLOWED_JORDAN_MOBILE_PREFIXES = ['077', '078', '079', '77', '78', '79'] as const;

export interface JordanPhoneValidationResult {
  isValid: boolean;
  canonicalPhone: string | null;
  error?: string;
}

/**
 * Validates and normalizes a Jordanian mobile phone number into the canonical storage format (+9627XXXXXXXX).
 * Returns canonical string or throws / returns validation failure.
 */
export function validateAndNormalizeJordanPhone(
  input: string | null | undefined,
  fieldLabel = 'رقم الهاتف'
): JordanPhoneValidationResult {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      canonicalPhone: null,
      error: `${fieldLabel} مطلوب ولا يمكن أن يكون فارغاً`,
    };
  }

  // 1. Trim whitespace
  const raw = input.trim();
  if (raw === '') {
    return {
      isValid: false,
      canonicalPhone: null,
      error: `${fieldLabel} مطلوب ولا يمكن أن يكون فارغاً`,
    };
  }

  // 2. Reject letters or forbidden characters (allow leading +, digits, and formatting spaces/dashes)
  if (/[^\d+\s-]/.test(raw)) {
    return {
      isValid: false,
      canonicalPhone: null,
      error: `يحتوي ${fieldLabel} على رموز أو أحرف غير صالحة`,
    };
  }

  // 3. Remove spaces and dashes for structural analysis
  const stripped = raw.replace(/[\s-]/g, '');

  // Reject duplicated plus or plus not at the start
  if ((stripped.match(/\+/g) || []).length > 1 || (stripped.includes('+') && !stripped.startsWith('+'))) {
    return {
      isValid: false,
      canonicalPhone: null,
      error: `صيغة ${fieldLabel} غير صالحة`,
    };
  }

  // Check international format starting with +962
  if (stripped.startsWith('+962')) {
    const afterCode = stripped.substring(4);
    // Disallow leading zero after +962 (e.g. +962079...)
    if (afterCode.startsWith('0')) {
      return {
        isValid: false,
        canonicalPhone: null,
        error: `لا يجوز وضع الصفر بعد رمز الدولة +962 في ${fieldLabel}`,
      };
    }
    // Must have exactly 9 digits starting with 77, 78, or 79
    if (!/^7[789]\d{7}$/.test(afterCode)) {
      return {
        isValid: false,
        canonicalPhone: null,
        error: `رقم الهاتف الدولي يجب أن يتكون من +962 متبوعاً بـ 9 أرقام تبدأ بـ 77 أو 78 أو 79`,
      };
    }
    return {
      isValid: true,
      canonicalPhone: `+962${afterCode}`,
    };
  }

  // Check international format starting with 00962
  if (stripped.startsWith('00962')) {
    const afterCode = stripped.substring(5);
    if (afterCode.startsWith('0')) {
      return {
        isValid: false,
        canonicalPhone: null,
        error: `لا يجوز وضع الصفر بعد رمز الدولة 00962 في ${fieldLabel}`,
      };
    }
    if (!/^7[789]\d{7}$/.test(afterCode)) {
      return {
        isValid: false,
        canonicalPhone: null,
        error: `رقم الهاتف الدولي يجب أن يتكون من 00962 متبوعاً بـ 9 أرقام تبدأ بـ 77 أو 78 أو 79`,
      };
    }
    return {
      isValid: true,
      canonicalPhone: `+962${afterCode}`,
    };
  }

  // Check un-prefixed international format starting with 962
  if (stripped.startsWith('962')) {
    const afterCode = stripped.substring(3);
    if (afterCode.startsWith('0')) {
      return {
        isValid: false,
        canonicalPhone: null,
        error: `لا يجوز وضع الصفر بعد رمز الدولة 962 في ${fieldLabel}`,
      };
    }
    if (!/^7[789]\d{7}$/.test(afterCode)) {
      return {
        isValid: false,
        canonicalPhone: null,
        error: `رقم الهاتف الدولي يجب أن يتكون من 962 متبوعاً بـ 9 أرقام تبدأ بـ 77 أو 78 أو 79`,
      };
    }
    return {
      isValid: true,
      canonicalPhone: `+962${afterCode}`,
    };
  }

  // Check standard local format starting with 07
  if (stripped.startsWith('07')) {
    if (!/^07[789]\d{7}$/.test(stripped)) {
      return {
        isValid: false,
        canonicalPhone: null,
        error: `رقم الهاتف الأردني المحلي يجب أن يتكون من 10 أرقام تبدأ بـ 077 أو 078 أو 079`,
      };
    }
    // Canonicalize: 079XXXXXXX -> +96279XXXXXXX
    const subscriber = stripped.substring(1); // 79XXXXXXX
    return {
      isValid: true,
      canonicalPhone: `+962${subscriber}`,
    };
  }

  // Catch-all invalid
  return {
    isValid: false,
    canonicalPhone: null,
    error: `رقم الهاتف غير صالح. يرجى إدخال رقم أردني صحيح (مثل 0791234567 أو +962791234567)`,
  };
}

/**
 * Validates and normalizes an optional secondary phone.
 * If empty/null/undefined, returns canonical null.
 * If provided, enforces exact same Jordan phone rules.
 */
export function validateAndNormalizeSecondaryJordanPhone(
  input: string | null | undefined
): JordanPhoneValidationResult {
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return {
      isValid: true,
      canonicalPhone: null,
    };
  }

  return validateAndNormalizeJordanPhone(input, 'رقم الهاتف الإضافي');
}

/**
 * Strict boolean validator
 */
export function isValidJordanPhone(input: string | null | undefined): boolean {
  return validateAndNormalizeJordanPhone(input).isValid;
}

/**
 * Format canonical phone for local display (e.g. +962791234567 -> 0791234567)
 */
export function formatJordanPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.startsWith('+9627') && phone.length === 13) {
    return '0' + phone.substring(4);
  }
  return phone;
}

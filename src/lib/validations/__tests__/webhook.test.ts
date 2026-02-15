import { describe, it, expect } from 'vitest';
import { growWebhookSchema, safeParseInt, safeParseFloat } from '../webhook';

describe('safeParseInt', () => {
  it('should parse valid integer string', () => {
    expect(safeParseInt('5')).toBe(5);
  });

  it('should parse zero', () => {
    expect(safeParseInt('0')).toBe(0);
  });

  it('should parse negative numbers', () => {
    expect(safeParseInt('-10')).toBe(-10);
  });

  it('should return default for empty string', () => {
    expect(safeParseInt('')).toBe(0);
  });

  it('should return custom default for empty string', () => {
    expect(safeParseInt('', 1)).toBe(1);
  });

  it('should return default for non-numeric string', () => {
    expect(safeParseInt('abc')).toBe(0);
  });

  it('should return custom default for non-numeric string', () => {
    expect(safeParseInt('abc', 1)).toBe(1);
  });

  it('should return default for whitespace-only string', () => {
    expect(safeParseInt('   ')).toBe(0);
  });

  it('should truncate decimal values', () => {
    expect(safeParseInt('5.9')).toBe(5);
  });

  it('should handle mixed alphanumeric (parseInt behavior)', () => {
    expect(safeParseInt('123abc')).toBe(123);
  });
});

describe('safeParseFloat', () => {
  it('should parse valid float string', () => {
    expect(safeParseFloat('99.50')).toBe(99.50);
  });

  it('should parse integer as float', () => {
    expect(safeParseFloat('100')).toBe(100);
  });

  it('should return null for empty string', () => {
    expect(safeParseFloat('')).toBeNull();
  });

  it('should return null for non-numeric string', () => {
    expect(safeParseFloat('abc')).toBeNull();
  });

  it('should return null for whitespace-only string', () => {
    expect(safeParseFloat('   ')).toBeNull();
  });

  it('should handle negative floats', () => {
    expect(safeParseFloat('-25.75')).toBe(-25.75);
  });

  it('should parse scientific notation', () => {
    expect(safeParseFloat('1.5e2')).toBe(150);
  });
});

describe('growWebhookSchema', () => {
  const validWebhookPayload = {
    err: '',
    status: 'success',
    data: {
      asmachta: '12345',
      cardSuffix: '1234',
      cardType: 'Visa',
      cardTypeCode: '1',
      cardBrand: 'Visa',
      cardBrandCode: '1',
      cardExp: '12/25',
      firstPaymentSum: '100.00',
      periodicalPaymentSum: '50.00',
      status: 'approved',
      statusCode: '000',
      transactionTypeId: '1',
      paymentType: 'credit',
      sum: '100.00',
      paymentsNum: '1',
      allPaymentsNum: '1',
      paymentDate: '2024-01-15',
      description: 'Monthly subscription',
      fullName: 'John Doe',
      payerPhone: '0501234567',
      payerEmail: 'john@example.com',
      transactionId: 'txn-123',
      transactionToken: 'token-abc',
      processId: 'process-456',
      processToken: 'ptoken-789',
    },
  };

  it('should accept valid GROW webhook payload', () => {
    const result = growWebhookSchema.safeParse(validWebhookPayload);
    expect(result.success).toBe(true);
  });

  it('should reject missing processId', () => {
    const { processId, ...dataWithoutProcessId } = validWebhookPayload.data;
    const payload = { ...validWebhookPayload, data: dataWithoutProcessId };
    const result = growWebhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject missing processToken', () => {
    const { processToken, ...dataWithoutProcessToken } = validWebhookPayload.data;
    const payload = { ...validWebhookPayload, data: dataWithoutProcessToken };
    const result = growWebhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  describe('numeric string parsing', () => {
    it('should transform paymentsNum string to number', () => {
      const result = growWebhookSchema.safeParse(validWebhookPayload);
      if (result.success) {
        expect(result.data.data.paymentsNum).toBe(1);
        expect(typeof result.data.data.paymentsNum).toBe('number');
      }
    });

    it('should transform allPaymentsNum string to number', () => {
      const payload = {
        ...validWebhookPayload,
        data: { ...validWebhookPayload.data, allPaymentsNum: '3' },
      };
      const result = growWebhookSchema.safeParse(payload);
      if (result.success) {
        expect(result.data.data.allPaymentsNum).toBe(3);
      }
    });

    it('should transform firstPaymentSum string to number', () => {
      const result = growWebhookSchema.safeParse(validWebhookPayload);
      if (result.success) {
        expect(result.data.data.firstPaymentSum).toBe(100);
        expect(typeof result.data.data.firstPaymentSum).toBe('number');
      }
    });

    it('should transform periodicalPaymentSum string to number', () => {
      const result = growWebhookSchema.safeParse(validWebhookPayload);
      if (result.success) {
        expect(result.data.data.periodicalPaymentSum).toBe(50);
      }
    });
  });

  describe('NaN handling', () => {
    it('should default paymentsNum to 1 when value is NaN', () => {
      const payload = {
        ...validWebhookPayload,
        data: { ...validWebhookPayload.data, paymentsNum: 'invalid' },
      };
      const result = growWebhookSchema.safeParse(payload);
      if (result.success) {
        expect(result.data.data.paymentsNum).toBe(1);
      }
    });

    it('should default allPaymentsNum to 1 when value is NaN', () => {
      const payload = {
        ...validWebhookPayload,
        data: { ...validWebhookPayload.data, allPaymentsNum: '' },
      };
      const result = growWebhookSchema.safeParse(payload);
      if (result.success) {
        expect(result.data.data.allPaymentsNum).toBe(1);
      }
    });

    it('should default firstPaymentSum to null when value is NaN', () => {
      const payload = {
        ...validWebhookPayload,
        data: { ...validWebhookPayload.data, firstPaymentSum: 'not-a-number' },
      };
      const result = growWebhookSchema.safeParse(payload);
      if (result.success) {
        expect(result.data.data.firstPaymentSum).toBeNull();
      }
    });

    it('should default periodicalPaymentSum to null when value is NaN', () => {
      const payload = {
        ...validWebhookPayload,
        data: { ...validWebhookPayload.data, periodicalPaymentSum: '' },
      };
      const result = growWebhookSchema.safeParse(payload);
      if (result.success) {
        expect(result.data.data.periodicalPaymentSum).toBeNull();
      }
    });
  });

  describe('optional fields', () => {
    it('should accept missing customFields', () => {
      const payload = { ...validWebhookPayload };
      // customFields is already optional
      const result = growWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should accept customFields with cField1 and cField2', () => {
      const payload = {
        ...validWebhookPayload,
        data: {
          ...validWebhookPayload.data,
          customFields: { cField1: 'user-123', cField2: 'plan-abc' },
        },
      };
      const result = growWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.customFields?.cField1).toBe('user-123');
        expect(result.data.data.customFields?.cField2).toBe('plan-abc');
      }
    });

    it('should accept payerBankAccountDetails default to empty string', () => {
      // validWebhookPayload.data already omits payerBankAccountDetails
      const payload = { ...validWebhookPayload };
      const result = growWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.payerBankAccountDetails).toBe('');
      }
    });
  });

  describe('required fields', () => {
    it('should reject missing status in data', () => {
      const { status, ...dataWithoutStatus } = validWebhookPayload.data;
      const payload = { ...validWebhookPayload, data: dataWithoutStatus };
      const result = growWebhookSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing transactionId', () => {
      const { transactionId, ...dataWithoutTxId } = validWebhookPayload.data;
      const payload = { ...validWebhookPayload, data: dataWithoutTxId };
      const result = growWebhookSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing asmachta', () => {
      const { asmachta, ...dataWithoutAsmachta } = validWebhookPayload.data;
      const payload = { ...validWebhookPayload, data: dataWithoutAsmachta };
      const result = growWebhookSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});

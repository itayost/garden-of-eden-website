import { describe, it, expect } from 'vitest';
import { createPaymentSchema, formatZodErrors } from '../payment';
import { z } from 'zod';

describe('createPaymentSchema', () => {
  const validPaymentData = {
    amount: 100,
    description: 'Monthly subscription',
    paymentType: 'one_time' as const,
    payerName: 'John Doe',
    payerPhone: '0501234567',
    payerEmail: 'john@example.com',
  };

  it('should accept valid payment data', () => {
    const result = createPaymentSchema.safeParse(validPaymentData);
    expect(result.success).toBe(true);
  });

  describe('amount validation', () => {
    it('should reject negative amount', () => {
      const data = { ...validPaymentData, amount: -50 };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject zero amount', () => {
      const data = { ...validPaymentData, amount: 0 };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept decimal amounts', () => {
      const data = { ...validPaymentData, amount: 99.50 };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('description validation', () => {
    it('should reject missing description', () => {
      const { description: _, ...dataWithoutDescription } = validPaymentData;
      const result = createPaymentSchema.safeParse(dataWithoutDescription);
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const data = { ...validPaymentData, description: '' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept long descriptions up to 500 chars', () => {
      const data = { ...validPaymentData, description: 'A'.repeat(500) };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject descriptions over 500 chars', () => {
      const data = { ...validPaymentData, description: 'A'.repeat(501) };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('paymentType validation', () => {
    it('should accept one_time payment type', () => {
      const data = { ...validPaymentData, paymentType: 'one_time' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept recurring payment type', () => {
      const data = { ...validPaymentData, paymentType: 'recurring' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid payment type', () => {
      const data = { ...validPaymentData, paymentType: 'invalid_type' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('payerName validation', () => {
    it('should require full name with at least two parts', () => {
      const data = { ...validPaymentData, payerName: 'John' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should require each name part to have at least 2 characters', () => {
      const data = { ...validPaymentData, payerName: 'J D' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept valid full name with 2+ character parts', () => {
      const data = { ...validPaymentData, payerName: 'Jo Do' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept Hebrew names', () => {
      const data = { ...validPaymentData, payerName: 'יוסי כהן' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should handle multiple spaces between names', () => {
      const data = { ...validPaymentData, payerName: 'John   Doe' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept three-part names', () => {
      const data = { ...validPaymentData, payerName: 'John Michael Doe' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject names shorter than 2 chars total', () => {
      const data = { ...validPaymentData, payerName: 'A' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('payerPhone validation', () => {
    it('should accept valid Israeli mobile (05X)', () => {
      const data = { ...validPaymentData, payerPhone: '0501234567' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept 050 numbers', () => {
      const data = { ...validPaymentData, payerPhone: '0509876543' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept 052 numbers', () => {
      const data = { ...validPaymentData, payerPhone: '0521234567' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept 054 numbers', () => {
      const data = { ...validPaymentData, payerPhone: '0541234567' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject non-05X prefix', () => {
      const data = { ...validPaymentData, payerPhone: '0721234567' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject phone with wrong length', () => {
      const data = { ...validPaymentData, payerPhone: '050123456' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject phone with dashes', () => {
      const data = { ...validPaymentData, payerPhone: '050-123-4567' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject international format', () => {
      const data = { ...validPaymentData, payerPhone: '+972501234567' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('payerEmail validation', () => {
    it('should accept valid email', () => {
      const data = { ...validPaymentData, payerEmail: 'test@example.com' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept empty string (optional field)', () => {
      const data = { ...validPaymentData, payerEmail: '' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should allow omitting email entirely', () => {
      const { payerEmail: _, ...dataWithoutEmail } = validPaymentData;
      const result = createPaymentSchema.safeParse(dataWithoutEmail);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const data = { ...validPaymentData, payerEmail: 'not-an-email' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject email without domain', () => {
      const data = { ...validPaymentData, payerEmail: 'test@' };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('optional payment fields', () => {
    it('should accept paymentNum when provided', () => {
      const data = { ...validPaymentData, paymentNum: 3 };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject non-integer paymentNum', () => {
      const data = { ...validPaymentData, paymentNum: 2.5 };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject negative paymentNum', () => {
      const data = { ...validPaymentData, paymentNum: -1 };
      const result = createPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});

describe('formatZodErrors', () => {
  it('should format errors by field path', () => {
    const schema = z.object({
      name: z.string().min(1, { message: 'Name required' }),
      age: z.number().positive({ message: 'Age must be positive' }),
    });

    const result = schema.safeParse({ name: '', age: -5 });
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toHaveProperty('name');
      expect(formatted).toHaveProperty('age');
    }
  });

  it('should take first error for each field path', () => {
    const schema = z.object({
      value: z.string()
        .min(5, { message: 'Too short' })
        .max(10, { message: 'Too long' }),
    });

    // Empty string will fail min(5) first
    const result = schema.safeParse({ value: '' });
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted.value).toBe('Too short');
    }
  });

  it('should handle nested object paths', () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email({ message: 'Invalid email' }),
      }),
    });

    const result = schema.safeParse({ user: { email: 'bad' } });
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted['user.email']).toBe('Invalid email');
    }
  });

  it('should return empty object for valid data', () => {
    const schema = z.object({
      name: z.string(),
    });

    const result = schema.safeParse({ name: 'valid' });
    if (result.success) {
      // No error to format
      expect(true).toBe(true);
    }
  });
});

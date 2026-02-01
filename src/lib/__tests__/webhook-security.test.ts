import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import { verifyWebhookSignature, verifyGrowProcessToken } from '../webhook-security';

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret';
  const rawBody = '{"event":"payment","amount":100}';

  function createValidSignature(body: string, secretKey: string, timestamp?: string): string {
    const payload = timestamp ? `${timestamp}.${body}` : body;
    return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
  }

  it('should return invalid for missing signature', () => {
    const result = verifyWebhookSignature(rawBody, null, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing signature');
  });

  it('should validate correct signature', () => {
    const signature = createValidSignature(rawBody, secret);
    const result = verifyWebhookSignature(rawBody, signature, secret);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject incorrect signature', () => {
    const wrongSignature = createValidSignature(rawBody, 'wrong-secret');
    const result = verifyWebhookSignature(rawBody, wrongSignature, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('should reject wrong length signature', () => {
    const shortSignature = 'abc123';
    const result = verifyWebhookSignature(rawBody, shortSignature, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('should reject tampered body', () => {
    const signature = createValidSignature(rawBody, secret);
    const tamperedBody = '{"event":"payment","amount":999}';
    const result = verifyWebhookSignature(tamperedBody, signature, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  describe('with timestamp (replay protection)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should validate current timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      vi.setSystemTime(now * 1000);

      const timestamp = String(now);
      const signature = createValidSignature(rawBody, secret, timestamp);

      const result = verifyWebhookSignature(rawBody, signature, secret, timestamp);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate timestamp within tolerance (5 minutes)', () => {
      const now = 1700000000;
      vi.setSystemTime(now * 1000);

      // Timestamp from 4 minutes ago (within 5 minute tolerance)
      const timestamp = String(now - 240);
      const signature = createValidSignature(rawBody, secret, timestamp);

      const result = verifyWebhookSignature(rawBody, signature, secret, timestamp);
      expect(result.valid).toBe(true);
    });

    it('should reject old timestamp (replay attack)', () => {
      const now = 1700000000;
      vi.setSystemTime(now * 1000);

      // Timestamp from 10 minutes ago (outside 5 minute tolerance)
      const oldTimestamp = String(now - 600);
      const signature = createValidSignature(rawBody, secret, oldTimestamp);

      const result = verifyWebhookSignature(rawBody, signature, secret, oldTimestamp);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp out of range');
    });

    it('should reject future timestamp', () => {
      const now = 1700000000;
      vi.setSystemTime(now * 1000);

      // Timestamp 10 minutes in the future
      const futureTimestamp = String(now + 600);
      const signature = createValidSignature(rawBody, secret, futureTimestamp);

      const result = verifyWebhookSignature(rawBody, signature, secret, futureTimestamp);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp out of range');
    });

    it('should use custom tolerance when provided', () => {
      const now = 1700000000;
      vi.setSystemTime(now * 1000);

      // Timestamp from 4 minutes ago
      const timestamp = String(now - 240);
      const signature = createValidSignature(rawBody, secret, timestamp);

      // With 3 minute tolerance, 4 minute old timestamp should fail
      const result = verifyWebhookSignature(rawBody, signature, secret, timestamp, 180);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp out of range');
    });
  });

  it('should reject invalid timestamp format', () => {
    const invalidTimestamp = 'not-a-number';
    const signature = createValidSignature(rawBody, secret);

    const result = verifyWebhookSignature(rawBody, signature, secret, invalidTimestamp);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid timestamp');
  });

  it('should validate signature when timestamp is null (no replay protection)', () => {
    const signature = createValidSignature(rawBody, secret);
    const result = verifyWebhookSignature(rawBody, signature, secret, null);
    expect(result.valid).toBe(true);
  });
});

describe('verifyGrowProcessToken', () => {
  const expectedToken = 'expected-process-token-123';

  it('should return true for matching tokens', () => {
    const payload = { processToken: expectedToken };
    const result = verifyGrowProcessToken(payload, expectedToken);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return false for non-matching tokens', () => {
    const payload = { processToken: 'wrong-token' };
    const result = verifyGrowProcessToken(payload, expectedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid processToken');
  });

  it('should return false when processToken is missing from payload', () => {
    const payload = { otherField: 'value' };
    const result = verifyGrowProcessToken(payload, expectedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing processToken in payload');
  });

  it('should return false for empty expected token', () => {
    const payload = { processToken: 'some-token' };
    const result = verifyGrowProcessToken(payload, '');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Process token not configured');
  });

  it('should return false when payload processToken is empty', () => {
    const payload = { processToken: '' };
    const result = verifyGrowProcessToken(payload, expectedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing processToken in payload');
  });

  it('should return false when tokens have different lengths', () => {
    const payload = { processToken: 'short' };
    const result = verifyGrowProcessToken(payload, expectedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid processToken');
  });

  it('should handle non-string processToken type', () => {
    const payload = { processToken: 12345 };
    const result = verifyGrowProcessToken(payload as { processToken: string }, expectedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid processToken type');
  });

  it('should handle null processToken in payload', () => {
    const payload = { processToken: null };
    const result = verifyGrowProcessToken(payload as unknown as { processToken: string }, expectedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing processToken in payload');
  });
});

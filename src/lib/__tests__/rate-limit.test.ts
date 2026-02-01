import { describe, it, expect } from 'vitest';
import { isAdminExempt, getRateLimitIdentifier } from '../rate-limit';

describe('isAdminExempt', () => {
  it('should return true for admin role', () => {
    expect(isAdminExempt('admin')).toBe(true);
  });

  it('should return false for trainee role', () => {
    expect(isAdminExempt('trainee')).toBe(false);
  });

  it('should return false for coach role', () => {
    expect(isAdminExempt('coach')).toBe(false);
  });

  it('should return false for null role', () => {
    expect(isAdminExempt(null)).toBe(false);
  });

  it('should return false for undefined role', () => {
    expect(isAdminExempt(undefined)).toBe(false);
  });

  it('should return false for empty string role', () => {
    expect(isAdminExempt('')).toBe(false);
  });
});

describe('getRateLimitIdentifier', () => {
  const testIp = '192.168.1.100';

  it('should return user ID when authenticated', () => {
    const userId = 'user-123-abc';
    expect(getRateLimitIdentifier(userId, testIp)).toBe(userId);
  });

  it('should return ip-prefixed string when userId is null', () => {
    expect(getRateLimitIdentifier(null, testIp)).toBe(`ip:${testIp}`);
  });

  it('should return ip-prefixed string when userId is undefined', () => {
    expect(getRateLimitIdentifier(undefined, testIp)).toBe(`ip:${testIp}`);
  });

  it('should return ip-prefixed string when userId is empty string', () => {
    expect(getRateLimitIdentifier('', testIp)).toBe(`ip:${testIp}`);
  });

  it('should handle IPv6 addresses', () => {
    const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
    expect(getRateLimitIdentifier(null, ipv6)).toBe(`ip:${ipv6}`);
  });

  it('should handle x-forwarded-for style IPs', () => {
    const forwardedIp = '203.0.113.195';
    expect(getRateLimitIdentifier(null, forwardedIp)).toBe(`ip:${forwardedIp}`);
  });

  it('should handle unknown IP placeholder', () => {
    expect(getRateLimitIdentifier(null, 'unknown')).toBe('ip:unknown');
  });
});

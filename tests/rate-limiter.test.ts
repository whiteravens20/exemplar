import { describe, it, expect } from 'vitest';

describe('DEPRECATED: Legacy Rate Limiter', () => {
  it('should skip legacy tests (rate limiter uses DB persistence now)', () => {
    // This test is for the legacy in-memory-only rate limiter.
    // The rate limiter has been refactored to use database persistence.
    // See tests/database.test.ts for current rate limiter tests.
    expect(true).toBe(true);
  });
});

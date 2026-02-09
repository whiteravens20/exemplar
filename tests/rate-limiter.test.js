#!/usr/bin/env node

/**
 * Unit tests for RateLimiter
 * Run with: node tests/rate-limiter.test.js
 */

const RateLimiter = require('../src/utils/rate-limiter');

// Simple test framework
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function test(name, fn) {
  testsRun++;
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Tests
console.log('\n🧪 Running RateLimiter Tests...\n');

test('Should allow requests within limit', () => {
  const limiter = new RateLimiter(3, 60000);
  const userId = 'user1';

  const result1 = limiter.checkLimit(userId);
  assert(result1.allowed, 'First request should be allowed');
  assertEquals(result1.remaining, 2, 'Should have 2 remaining');

  const result2 = limiter.checkLimit(userId);
  assert(result2.allowed, 'Second request should be allowed');
  assertEquals(result2.remaining, 1, 'Should have 1 remaining');

  const result3 = limiter.checkLimit(userId);
  assert(result3.allowed, 'Third request should be allowed');
  assertEquals(result3.remaining, 0, 'Should have 0 remaining');
});

test('Should block requests exceeding limit', () => {
  const limiter = new RateLimiter(2, 60000);
  const userId = 'user2';

  limiter.checkLimit(userId);
  limiter.checkLimit(userId);
  
  const result = limiter.checkLimit(userId);
  assert(!result.allowed, 'Should be blocked after limit');
  assertEquals(result.remaining, 0, 'Should have 0 remaining');
  assert(result.retryAfter > 0, 'Should have retryAfter value');
});

test('Should reset after time window', (done) => {
  const limiter = new RateLimiter(2, 100); // 100ms window
  const userId = 'user3';

  limiter.checkLimit(userId);
  limiter.checkLimit(userId);
  
  const blocked = limiter.checkLimit(userId);
  assert(!blocked.allowed, 'Should be blocked');

  // Wait for time window to pass
  setTimeout(() => {
    const result = limiter.checkLimit(userId);
    assert(result.allowed, 'Should be allowed after time window');
    assertEquals(result.remaining, 1, 'Should have 1 remaining after reset');
  }, 150);
});

test('Should track multiple users independently', () => {
  const limiter = new RateLimiter(2, 60000);

  limiter.checkLimit('userA');
  limiter.checkLimit('userA');
  
  const userABlocked = limiter.checkLimit('userA');
  assert(!userABlocked.allowed, 'UserA should be blocked');

  const userBAllowed = limiter.checkLimit('userB');
  assert(userBAllowed.allowed, 'UserB should be allowed');
  assertEquals(userBAllowed.remaining, 1, 'UserB should have 1 remaining');
});

test('Should reset user limit manually', () => {
  const limiter = new RateLimiter(2, 60000);
  const userId = 'user4';

  limiter.checkLimit(userId);
  limiter.checkLimit(userId);
  
  const blocked = limiter.checkLimit(userId);
  assert(!blocked.allowed, 'Should be blocked');

  limiter.reset(userId);

  const result = limiter.checkLimit(userId);
  assert(result.allowed, 'Should be allowed after reset');
  assertEquals(result.remaining, 1, 'Should have 1 remaining after reset');
});

test('Should cleanup old entries', () => {
  const limiter = new RateLimiter(2, 50); // 50ms window
  
  limiter.checkLimit('user5');
  limiter.checkLimit('user6');
  
  const statsBefore = limiter.getStats();
  assertEquals(statsBefore.totalUsers, 2, 'Should have 2 users tracked');

  setTimeout(() => {
    limiter.cleanup();
    const statsAfter = limiter.getStats();
    assertEquals(statsAfter.totalUsers, 0, 'Should have 0 users after cleanup');
  }, 100);
});

test('Should provide correct stats', () => {
  const limiter = new RateLimiter(3, 60000);

  limiter.checkLimit('user7');
  limiter.checkLimit('user8');
  limiter.checkLimit('user8');

  const stats = limiter.getStats();
  assertEquals(stats.totalUsers, 2, 'Should track 2 users');
  assert(stats.activeUsers === 2, 'Should have 2 active users');
});

test('Should handle edge case - zero requests', () => {
  const limiter = new RateLimiter(5, 60000);

  const stats = limiter.getStats();
  assertEquals(stats.totalUsers, 0, 'Should start with 0 users');
});

// Wait for async tests to complete
setTimeout(() => {
  console.log('\n═══════════════════════════════════');
  console.log('📊 Test Summary');
  console.log('═══════════════════════════════════');
  console.log(`  Total:  ${testsRun}`);
  console.log(`  Passed: ${testsPassed}`);
  console.log(`  Failed: ${testsFailed}`);
  console.log('═══════════════════════════════════\n');

  if (testsFailed === 0) {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed!\n');
    process.exit(1);
  }
}, 200);

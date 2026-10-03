import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const connect = vi.fn();

vi.mock('pg', () => ({
  default: {
    Pool: class {
      connect = connect;
      on = vi.fn();
      end = vi.fn().mockResolvedValue(undefined);
    },
  },
}));

vi.mock('../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const working = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };

describe('DatabaseConnection - start without a database', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    connect.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function startDegraded() {
    const db = (await import('../src/db/connection.js')).default;
    connect.mockRejectedValue(new Error('getaddrinfo ENOTFOUND postgres'));
    const started = db.initialize();
    // Three retries, five seconds apart, before the bot gives up and starts.
    await vi.advanceTimersByTimeAsync(15_000);
    await started;
    return db;
  }

  it('starts degraded when the database is down', async () => {
    const db = await startDegraded();
    expect(db.isAvailable()).toBe(false);
    await db.close();
  });

  it('picks the database up once it is back, without a restart', async () => {
    const db = await startDegraded();
    const listener = vi.fn();
    db.onReconnect(listener);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(db.isAvailable()).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    connect.mockResolvedValue(working);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(db.isAvailable()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Connected again: the background check stops.
    const calls = connect.mock.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(connect.mock.calls.length).toBe(calls);
    await db.close();
  });

  it('runs one attempt at a time when connecting outlasts the interval', async () => {
    const db = await startDegraded();
    const listener = vi.fn();
    db.onReconnect(listener);
    const before = connect.mock.calls.length;

    connect.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(working), 70_000))
    );
    await vi.advanceTimersByTimeAsync(30_000);
    expect(connect.mock.calls.length).toBe(before + 1);

    // Two more ticks pass while that attempt is still connecting.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(connect.mock.calls.length).toBe(before + 1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(db.isAvailable()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    await db.close();
  });
});

import { describe, it, expect } from 'vitest';
import { ConcurrencyLimiter } from '../src/utils/concurrency-limiter.js';

/** A task that holds its slot until `finish()` is called. */
function task(limiter: ConcurrencyLimiter, log: string[], name: string) {
  let finish!: () => void;
  const held = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const done = (async () => {
    if (!(await limiter.acquire())) {
      log.push(`${name}:rejected`);
      return;
    }
    log.push(`${name}:start`);
    await held;
    log.push(`${name}:end`);
    limiter.release();
  })();
  return { finish, done };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('ConcurrencyLimiter', () => {
  it('runs at most `limit` tasks at once and the rest in arrival order', async () => {
    const limiter = new ConcurrencyLimiter(() => 2, 100);
    const log: string[] = [];
    const tasks = ['a', 'b', 'c', 'd'].map((name) => task(limiter, log, name));
    await tick();
    expect(log).toEqual(['a:start', 'b:start']);
    expect(limiter.waitingCount).toBe(2);

    tasks[1].finish();
    await tick();
    expect(log).toEqual(['a:start', 'b:start', 'b:end', 'c:start']);

    tasks[0].finish();
    tasks[2].finish();
    await tick();
    const rest = log.slice(4);
    expect([...rest].sort()).toEqual(['a:end', 'c:end', 'd:start']);
    // d starts only once a slot has been released.
    expect(rest.indexOf('d:start')).toBeGreaterThan(rest.indexOf('a:end'));

    tasks[3].finish();
    await Promise.all(tasks.map((t) => t.done));
    expect(log.filter((entry) => entry.endsWith(':end'))).toHaveLength(4);
    expect(limiter.waitingCount).toBe(0);
  });

  it('runs every task: nothing is skipped while there is room to wait', async () => {
    const limiter = new ConcurrencyLimiter(() => 1, 100);
    const log: string[] = [];
    const tasks = Array.from({ length: 20 }, (_, i) => task(limiter, log, `t${i}`));
    for (const t of tasks) {
      await tick();
      t.finish();
    }
    await Promise.all(tasks.map((t) => t.done));
    expect(log.filter((entry) => entry.endsWith(':start'))).toHaveLength(20);
    expect(log.some((entry) => entry.endsWith(':rejected'))).toBe(false);
  });

  it('turns a task away only when the waiting line is full', async () => {
    const limiter = new ConcurrencyLimiter(() => 1, 2);
    const log: string[] = [];
    const tasks = ['a', 'b', 'c', 'd'].map((name) => task(limiter, log, name));
    await tick();
    expect(log).toEqual(['a:start', 'd:rejected']);

    // The rejected task took no slot: the line still drains in order.
    for (const t of tasks) t.finish();
    await Promise.all(tasks.map((t) => t.done));
    expect(log).toEqual(['a:start', 'd:rejected', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('frees the slot when nobody is waiting', async () => {
    const limiter = new ConcurrencyLimiter(() => 1, 10);
    expect(await limiter.acquire()).toBe(true);
    limiter.release();
    expect(await limiter.acquire()).toBe(true);
    limiter.release();
  });

  it('treats a limit below one as one', async () => {
    const limiter = new ConcurrencyLimiter(() => 0, 10);
    expect(await limiter.acquire()).toBe(true);
    limiter.release();
  });
});

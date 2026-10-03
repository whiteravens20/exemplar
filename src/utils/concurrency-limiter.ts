/**
 * Lets a limited number of tasks run at once and makes the rest wait their
 * turn, in arrival order. Nothing is turned away until `maxWaiting` tasks are
 * already waiting.
 *
 *   if (await limiter.acquire()) {
 *     try { await work(); } finally { limiter.release(); }
 *   }
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  /**
   * @param limit Read on every acquire, so a configured value can change.
   *   Values below 1 count as 1.
   */
  constructor(
    private readonly limit: () => number,
    private readonly maxWaiting: number
  ) {}

  /** Tasks waiting for a slot. */
  get waitingCount(): number {
    return this.waiting.length;
  }

  /**
   * Wait for a slot. Resolves to false, without taking one, when too many
   * tasks are waiting already; `release()` must not be called then.
   */
  async acquire(): Promise<boolean> {
    if (this.active < Math.max(1, this.limit())) {
      this.active++;
      return true;
    }
    if (this.waiting.length >= this.maxWaiting) return false;
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    return true;
  }

  /** Hand the slot to the task that has waited longest, or free it. */
  release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }
}

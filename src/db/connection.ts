import pg from 'pg';
import logger from '../utils/logger.js';
import config from '../config/config.js';

const { Pool } = pg;

/** How often a bot that started without a database looks for it again. */
const RECONNECT_INTERVAL_MS = 30 * 1000;

class DatabaseConnection {
  private pool: pg.Pool | null = null;
  private isConnected: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnecting = false;
  private readonly reconnectListeners: Array<() => void> = [];

  async initialize(): Promise<void> {
    const dbConfig = config.config.database;

    const poolConfig: pg.PoolConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.name,
      user: dbConfig.user,
      password: dbConfig.password,
      max: dbConfig.maxConnections,
      idleTimeoutMillis: dbConfig.idleTimeoutMs,
      connectionTimeoutMillis: dbConfig.connectionTimeoutMs,
      statement_timeout: 30000, // 30s max query execution time
    };

    if (dbConfig.ssl) {
      poolConfig.ssl = {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      };
    }

    this.pool = new Pool(poolConfig);

    // Emitted when an idle client loses its connection. The pool drops that
    // client and opens a new one on demand, so availability is unaffected.
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', {
        error: err.message,
        stack: err.stack,
      });
    });

    await this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) {
        throw new Error('Pool not initialized');
      }
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isConnected = true;
      this.retryCount = 0;
      logger.info('Database connection established successfully', {
        host: config.config.database.host,
        database: config.config.database.name,
      });

      return true;
    } catch (error) {
      this.isConnected = false;
      logger.error('Database connection failed', {
        error: (error as Error).message,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
      });

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(
          `Retrying database connection in ${this.retryDelay / 1000}s...`,
          {
            attempt: this.retryCount,
            maxRetries: this.maxRetries,
          }
        );

        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.testConnection();
      }

      logger.warn(
        'Database connection unavailable - operating in degraded mode',
        {
          message:
            'Bot will use in-memory fallbacks for rate limiting and caching',
        }
      );

      this.scheduleReconnect();
      return false;
    }
  }

  /**
   * Run `listener` when the database becomes available after a start without
   * one. For state that is read once at startup and would otherwise stay empty
   * until the next restart.
   */
  onReconnect(listener: () => void): void {
    this.reconnectListeners.push(listener);
  }

  /**
   * Keep looking for the database in the background after a failed start, so
   * one that comes up later is used without restarting the bot. A database lost
   * while the bot runs needs none of this: the pool reconnects on demand.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(() => {
      void this.tryReconnect();
    }, RECONNECT_INTERVAL_MS);
    this.reconnectTimer.unref();
  }

  private stopReconnect(): void {
    if (!this.reconnectTimer) return;
    clearInterval(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private async tryReconnect(): Promise<void> {
    // One attempt at a time: a connect that outlasts the interval must not be
    // joined by a second one, or both would report the reconnect.
    if (!this.pool || this.isConnected || this.reconnecting) return;
    this.reconnecting = true;
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
    } catch (error) {
      logger.debug('Database still unavailable', {
        error: (error as Error).message,
      });
      return;
    } finally {
      this.reconnecting = false;
    }

    this.isConnected = true;
    this.retryCount = 0;
    this.stopReconnect();
    logger.info('Database connection established after a start without one', {
      host: config.config.database.host,
      database: config.config.database.name,
    });
    for (const listener of this.reconnectListeners) {
      try {
        listener();
      } catch (error) {
        logger.error('Database reconnect listener failed', {
          error: (error as Error).message,
        });
      }
    }
  }

  getPool(): pg.Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  isAvailable(): boolean {
    return this.isConnected && this.pool !== null;
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<pg.QueryResult<T>> {
    if (!this.isAvailable()) {
      throw new Error('Database connection not available');
    }

    try {
      if (!this.pool) {
        throw new Error('Database pool not initialized');
      }
      const result = await this.pool.query<T>(text, params);
      return result;
    } catch (error) {
      logger.error('Database query failed', {
        error: (error as Error).message,
        query: text.substring(0, 100),
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    this.stopReconnect();
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }
}

export default new DatabaseConnection();

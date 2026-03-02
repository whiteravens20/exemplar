import pg from 'pg';
import logger from '../utils/logger.js';
import config from '../config/config.js';

const { Pool } = pg;

class DatabaseConnection {
  private pool: pg.Pool | null = null;
  private isConnected: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 5000;

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

    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', {
        error: err.message,
        stack: err.stack,
      });
      this.isConnected = false;
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

      return false;
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
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }
}

export default new DatabaseConnection();

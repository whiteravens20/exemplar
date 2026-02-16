const { Pool } = require('pg');
const logger = require('../utils/logger');
const config = require('../config/config');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  async initialize() {
    const dbConfig = config.config.database;

    const poolConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.name,
      user: dbConfig.user,
      password: dbConfig.password,
      max: dbConfig.maxConnections,
      idleTimeoutMillis: dbConfig.idleTimeoutMs,
      connectionTimeoutMillis: dbConfig.connectionTimeoutMs
    };

    // Only add SSL if explicitly enabled
    if (dbConfig.ssl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', {
        error: err.message,
        stack: err.stack
      });
      this.isConnected = false;
    });

    // Attempt initial connection
    await this.testConnection();
  }

  async testConnection() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      this.isConnected = true;
      this.retryCount = 0;
      logger.info('Database connection established successfully', {
        host: config.config.database.host,
        database: config.config.database.name
      });
      
      return true;
    } catch (error) {
      this.isConnected = false;
      logger.error('Database connection failed', {
        error: error.message,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      });

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(`Retrying database connection in ${this.retryDelay / 1000}s...`, {
          attempt: this.retryCount,
          maxRetries: this.maxRetries
        });
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.testConnection();
      }

      logger.warn('Database connection unavailable - operating in degraded mode', {
        message: 'Bot will use in-memory fallbacks for rate limiting and caching'
      });
      
      return false;
    }
  }

  getPool() {
    return this.pool;
  }

  isAvailable() {
    return this.isConnected && this.pool !== null;
  }

  async query(text, params) {
    if (!this.isAvailable()) {
      throw new Error('Database connection not available');
    }

    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      logger.error('Database query failed', {
        error: error.message,
        query: text.substring(0, 100) // Log first 100 chars
      });
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }
}

// Export singleton instance
module.exports = new DatabaseConnection();

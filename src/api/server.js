const express = require('express');
const logger = require('../utils/logger');
const db = require('../db/connection');

class HealthCheckServer {
  constructor(port) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.get('/health', async (req, res) => {
      try {
        const health = {
          status: 'ok',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          database: 'disconnected'
        };

        // Test database connection
        if (db.isAvailable()) {
          try {
            await db.query('SELECT 1', []);
            health.database = 'connected';
          } catch (dbError) {
            health.database = 'degraded';
            health.databaseError = dbError.message;
            logger.warn('Database health check failed', { error: dbError.message });
          }
        } else {
          health.database = 'degraded';
          health.databaseNote = 'Using in-memory fallbacks';
        }

        const statusCode = health.database === 'connected' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        logger.error('Health check endpoint error', { error: error.message });
        res.status(500).json({
          status: 'error',
          error: error.message
        });
      }
    });

    // Liveness probe - always returns OK if server is running
    this.app.get('/alive', (req, res) => {
      res.status(200).json({ alive: true });
    });

    // Readiness probe - checks if bot is ready to handle requests
    this.app.get('/ready', async (req, res) => {
      const ready = db.isAvailable();
      res.status(ready ? 200 : 503).json({
        ready,
        database: db.isAvailable()
      });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info(`Health check server started`, { port: this.port });
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Health check server error', { error: error.message });
          reject(error);
        });
      } catch (error) {
        logger.error('Failed to start health check server', { error: error.message });
        reject(error);
      }
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Health check server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = HealthCheckServer;

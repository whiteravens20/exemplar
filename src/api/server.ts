import express, { type Request, type Response } from 'express';
import type { Server } from 'http';
import logger from '../utils/logger.js';
import db from '../db/connection.js';

interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  database: string;
  databaseError?: string;
  databaseNote?: string;
}

class HealthCheckServer {
  private port: number;
  private app: express.Application;
  private server: Server | null = null;

  constructor(port: number) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get('/health', async (_req: Request, res: Response) => {
      try {
        const health: HealthResponse = {
          status: 'ok',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          database: 'disconnected',
        };

        if (db.isAvailable()) {
          try {
            await db.query('SELECT 1', []);
            health.database = 'connected';
          } catch (dbError) {
            health.database = 'degraded';
            health.databaseError = (dbError as Error).message;
            logger.warn('Database health check failed', {
              error: (dbError as Error).message,
            });
          }
        } else {
          health.database = 'degraded';
          health.databaseNote = 'Using in-memory fallbacks';
        }

        const statusCode = health.database === 'connected' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        logger.error('Health check endpoint error', {
          error: (error as Error).message,
        });
        res.status(500).json({
          status: 'error',
          error: (error as Error).message,
        });
      }
    });

    this.app.get('/alive', (_req: Request, res: Response) => {
      res.status(200).json({ alive: true });
    });

    this.app.get('/ready', (_req: Request, res: Response) => {
      const ready = db.isAvailable();
      res.status(ready ? 200 : 503).json({
        ready,
        database: db.isAvailable(),
      });
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info('Health check server started', { port: this.port });
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('Health check server error', {
            error: error.message,
          });
          reject(error);
        });
      } catch (error) {
        logger.error('Failed to start health check server', {
          error: (error as Error).message,
        });
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
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

export default HealthCheckServer;

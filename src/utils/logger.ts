import fs from 'fs';
import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

/**
 * Whether the log files can be written. A file transport that cannot open its
 * file never reports it; it stops taking entries once its buffer is full, and
 * that stalls the whole logger, console included. A bind-mounted `logs`
 * directory is the usual cause: Docker creates it as root and the bot does not
 * run as root.
 */
function canWriteLogFiles(): boolean {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.accessSync(logDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

const fileLogging = canWriteLogFiles();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'discord-bot' },
  transports: [
    ...(fileLogging
      ? [
          new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
          }),
        ]
      : []),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

if (!fileLogging) {
  logger.warn(
    `Log directory ${logDir} is not writable — logging to the console only`
  );
}

export default logger;

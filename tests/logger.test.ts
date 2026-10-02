import fs from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const transportNames = async (): Promise<string[]> => {
  const logger = (await import('../src/utils/logger.js')).default;
  return logger.transports.map((transport) => transport.constructor.name);
};

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs to files and the console when the log directory is writable', async () => {
    expect(await transportNames()).toEqual(['File', 'File', 'Console']);
  });

  it('logs to the console only when the log directory is not writable', async () => {
    vi.spyOn(fs, 'accessSync').mockImplementation(() => {
      throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    });
    expect(await transportNames()).toEqual(['Console']);
  });

  it('logs to the console only when the log directory cannot be created', async () => {
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw Object.assign(new Error('EROFS: read-only file system'), { code: 'EROFS' });
    });
    expect(await transportNames()).toEqual(['Console']);
  });
});

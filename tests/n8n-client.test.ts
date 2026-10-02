import { describe, it, expect } from 'vitest';
import { redactWebhookUrl } from '../src/utils/n8n-client.js';

describe('redactWebhookUrl', () => {
  it('keeps the scheme and host and drops the path', () => {
    expect(redactWebhookUrl('https://n8n.example.com/webhook/secret-path')).toBe(
      'https://n8n.example.com/[REDACTED]'
    );
  });

  it('keeps the port and drops the query string', () => {
    expect(redactWebhookUrl('http://192.168.1.10:5678/webhook/x?token=abc')).toBe(
      'http://192.168.1.10:5678/[REDACTED]'
    );
  });

  it('gives nothing away for a value that is not a URL', () => {
    expect(redactWebhookUrl('not a url')).toBe('[REDACTED]');
    expect(redactWebhookUrl('')).toBe('[REDACTED]');
  });
});

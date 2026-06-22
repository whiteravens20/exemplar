import { describe, it, expect } from 'vitest';
import { buildAuthorizeUrl } from '../src/api/dashboard/oauth.js';

describe('buildAuthorizeUrl', () => {
  const url = new URL(
    buildAuthorizeUrl({
      clientId: 'client-123',
      redirectUri: 'https://dash.example.com/callback',
      state: 'signed-state',
    })
  );

  it('targets the Discord authorize endpoint', () => {
    expect(url.origin + url.pathname).toBe(
      'https://discord.com/api/oauth2/authorize'
    );
  });

  it('requests only the identify scope with response_type=code', () => {
    expect(url.searchParams.get('scope')).toBe('identify');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('carries the client id, redirect uri and CSRF state', () => {
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://dash.example.com/callback'
    );
    expect(url.searchParams.get('state')).toBe('signed-state');
  });
});

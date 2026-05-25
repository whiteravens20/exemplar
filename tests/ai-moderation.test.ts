import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelType } from 'discord.js';
import configManager from '../src/config/config.js';
import {
  isEnabled,
  shouldAnalyze,
  validateVerdict,
} from '../src/utils/ai-moderation.js';

// Helpers ---------------------------------------------------------------------

function setMode(mode: 'off' | 'shadow' | 'enforce', url = ''): void {
  configManager.config.moderation.aiMode = mode;
  configManager.config.moderation.aiModerationUrl = url;
}

function setExempt(includeChannels: string[], exemptRoles: string[]): void {
  configManager.config.moderation.includeChannels = includeChannels;
  configManager.config.moderation.exemptRoles = exemptRoles;
}

function makeMessage(overrides: Record<string, unknown> = {}): unknown {
  const baseChannel = {
    type: ChannelType.GuildText,
  };
  return {
    author: { bot: false, id: 'user-1', username: 'alice' },
    system: false,
    content: 'hello world',
    channel: baseChannel,
    channelId: 'chan-1',
    guild: { id: 'guild-1' },
    member: { roles: { cache: new Map() } },
    ...overrides,
  };
}

beforeEach(() => {
  setMode('off');
  // Default test setup: channel "chan-1" enrolled, no role exemptions.
  // shouldAnalyze() now requires explicit channel opt-in.
  setExempt(['chan-1'], []);
});

// validateVerdict -------------------------------------------------------------

describe('validateVerdict', () => {
  it('accepts allow', () => {
    expect(validateVerdict({ action: 'allow' })).toEqual({ action: 'allow' });
  });

  it('accepts warn with reason', () => {
    expect(
      validateVerdict({ action: 'warn', reason: 'spam' })
    ).toEqual({ action: 'warn', reason: 'spam' });
  });

  it('accepts timeout with parseable duration', () => {
    expect(
      validateVerdict({ action: 'timeout', duration: '10m', reason: 'flood' })
    ).toEqual({ action: 'timeout', duration: '10m', reason: 'flood' });
  });

  it('rejects timeout without duration', () => {
    expect(validateVerdict({ action: 'timeout' })).toBeNull();
  });

  it('rejects timeout with unparseable duration', () => {
    expect(
      validateVerdict({ action: 'timeout', duration: 'forever' })
    ).toBeNull();
  });

  it('accepts delete', () => {
    expect(validateVerdict({ action: 'delete' })).toEqual({ action: 'delete' });
  });

  it('rejects ban (not in AI contract)', () => {
    expect(validateVerdict({ action: 'ban' })).toBeNull();
  });

  it('rejects unknown action', () => {
    expect(validateVerdict({ action: 'detonate' })).toBeNull();
  });

  it('rejects missing action', () => {
    expect(validateVerdict({ reason: 'whatever' })).toBeNull();
  });

  it('rejects non-object input', () => {
    expect(validateVerdict(null)).toBeNull();
    expect(validateVerdict('warn')).toBeNull();
    expect(validateVerdict(42)).toBeNull();
  });
});

// isEnabled -------------------------------------------------------------------

describe('isEnabled', () => {
  it('is false when mode is off', () => {
    setMode('off', 'https://example.com/hook');
    expect(isEnabled()).toBe(false);
  });

  it('is false when mode is set but URL is missing', () => {
    setMode('shadow', '');
    expect(isEnabled()).toBe(false);
  });

  it('is true when mode is shadow with URL', () => {
    setMode('shadow', 'https://example.com/hook');
    expect(isEnabled()).toBe(true);
  });

  it('is true when mode is enforce with URL', () => {
    setMode('enforce', 'https://example.com/hook');
    expect(isEnabled()).toBe(true);
  });
});

// shouldAnalyze ---------------------------------------------------------------

describe('shouldAnalyze', () => {
  it('passes for a normal guild text message', () => {
    expect(shouldAnalyze(makeMessage() as never)).toBe(true);
  });

  it('skips bot authors', () => {
    expect(
      shouldAnalyze(
        makeMessage({ author: { bot: true, id: 'b', username: 'b' } }) as never
      )
    ).toBe(false);
  });

  it('skips system messages', () => {
    expect(shouldAnalyze(makeMessage({ system: true }) as never)).toBe(false);
  });

  it('skips DM channels', () => {
    expect(
      shouldAnalyze(
        makeMessage({ channel: { type: ChannelType.DM }, guild: null }) as never
      )
    ).toBe(false);
  });

  it('skips empty / very short content', () => {
    expect(shouldAnalyze(makeMessage({ content: '' }) as never)).toBe(false);
    expect(shouldAnalyze(makeMessage({ content: 'hi' }) as never)).toBe(false);
    expect(shouldAnalyze(makeMessage({ content: '   ' }) as never)).toBe(false);
  });

  it('skips channels not in the include list', () => {
    setExempt(['some-other-channel'], []);
    expect(shouldAnalyze(makeMessage() as never)).toBe(false);
  });

  it('skips everything when include list is empty (strict opt-in)', () => {
    setExempt([], []);
    expect(shouldAnalyze(makeMessage() as never)).toBe(false);
  });

  it('skips authors with an exempt role', () => {
    setExempt(['chan-1'], ['mod-role']);
    const roleCache = new Map<string, unknown>([['mod-role', {}]]);
    const msg = makeMessage({ member: { roles: { cache: roleCache } } });
    expect(shouldAnalyze(msg as never)).toBe(false);
  });

  it('still analyses when author has only non-exempt roles', () => {
    setExempt(['chan-1'], ['mod-role']);
    const roleCache = new Map<string, unknown>([['some-other-role', {}]]);
    const msg = makeMessage({ member: { roles: { cache: roleCache } } });
    expect(shouldAnalyze(msg as never)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  formatDuration,
  canModerate,
  checkBasePermissions,
} from '../src/utils/moderation-actions.js';

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30_000);
  });

  it('parses minutes', () => {
    expect(parseDuration('10m')).toBe(600_000);
  });

  it('parses hours', () => {
    expect(parseDuration('2h')).toBe(7_200_000);
  });

  it('parses days', () => {
    expect(parseDuration('1d')).toBe(86_400_000);
  });

  it('returns null for invalid input', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('10x')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(45_000)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125_000)).toBe('2m 5s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3_660_000)).toBe('1h 1m');
  });

  it('formats days and hours', () => {
    expect(formatDuration(90_000_000)).toBe('1d 1h');
  });
});

describe('canModerate', () => {
  const mockOwnerId = 'owner-123';
  const mockGuild = { ownerId: mockOwnerId };

  it('allows moderation of lower role member', () => {
    const moderator = {
      id: 'mod-1',
      guild: mockGuild,
      roles: { highest: { position: 5 } },
    };
    const target = {
      id: 'user-1',
      roles: { highest: { position: 2 } },
    };
    expect(canModerate(moderator as any, target as any)).toBe(true);
  });

  it('blocks self-action', () => {
    const moderator = {
      id: 'mod-1',
      guild: mockGuild,
      roles: { highest: { position: 5 } },
    };
    expect(canModerate(moderator as any, moderator as any)).toBe(false);
  });

  it('blocks action on owner', () => {
    const moderator = {
      id: 'mod-1',
      guild: mockGuild,
      roles: { highest: { position: 5 } },
    };
    const target = {
      id: mockOwnerId,
      roles: { highest: { position: 2 } },
    };
    expect(canModerate(moderator as any, target as any)).toBe(false);
  });

  it('blocks action on higher or equal role', () => {
    const moderator = {
      id: 'mod-1',
      guild: mockGuild,
      roles: { highest: { position: 5 } },
    };
    const target = {
      id: 'user-1',
      roles: { highest: { position: 5 } },
    };
    expect(canModerate(moderator as any, target as any)).toBe(false);
  });
});

describe('checkBasePermissions', () => {
  const mockOwnerId = 'owner-123';
  const mockGuild = { ownerId: mockOwnerId };
  const KICK_MEMBERS = 1n << 1n;

  it('returns null when permissions and hierarchy are valid', () => {
    const moderator = {
      id: 'mod-1',
      guild: mockGuild,
      permissions: { has: () => true },
      roles: { highest: { position: 5 } },
    };
    const target = {
      id: 'user-1',
      roles: { highest: { position: 2 } },
    };
    expect(
      checkBasePermissions(moderator as any, target as any, KICK_MEMBERS)
    ).toBeNull();
  });

  it('returns error when missing permission', () => {
    const moderator = {
      id: 'mod-1',
      guild: mockGuild,
      permissions: { has: () => false },
      roles: { highest: { position: 5 } },
    };
    const target = {
      id: 'user-1',
      roles: { highest: { position: 2 } },
    };
    const result = checkBasePermissions(moderator as any, target as any, KICK_MEMBERS);
    expect(result).not.toBeNull();
    expect(result?.success).toBe(false);
    expect(result?.content).toContain('Nie masz wymaganych uprawnień');
  });

  it('returns error for self-action', () => {
    const moderator = {
      id: 'mod-1',
      guild: mockGuild,
      permissions: { has: () => true },
      roles: { highest: { position: 5 } },
    };
    const result = checkBasePermissions(
      moderator as any,
      moderator as any,
      KICK_MEMBERS
    );
    expect(result).not.toBeNull();
    expect(result?.content).toContain('sobie');
  });
});

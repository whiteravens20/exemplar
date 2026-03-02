import { describe, it, expect } from 'vitest';
import { hasPermission, isModeratorOrAdmin } from '../src/utils/permissions.js';
import { Collection, PermissionsBitField } from 'discord.js';
import type { GuildMember, Role } from 'discord.js';

function createMockMember(
  roleIds: string[],
  permissions: bigint[] = []
): GuildMember {
  const roles = new Collection<string, Role>();
  for (const id of roleIds) {
    roles.set(id, { id } as Role);
  }

  const permBitField = new PermissionsBitField(permissions);

  return {
    roles: { cache: roles },
    permissions: permBitField,
  } as unknown as GuildMember;
}

describe('hasPermission', () => {
  it('should return true when member has an allowed role', () => {
    const member = createMockMember(['role-1', 'role-2']);
    expect(hasPermission(member, ['role-2'])).toBe(true);
  });

  it('should return false when member has no allowed roles', () => {
    const member = createMockMember(['role-1']);
    expect(hasPermission(member, ['role-99'])).toBe(false);
  });

  it('should return false for empty allowed roles', () => {
    const member = createMockMember(['role-1']);
    expect(hasPermission(member, [])).toBe(false);
  });

  it('should handle member with multiple matching roles', () => {
    const member = createMockMember(['role-1', 'role-2', 'role-3']);
    expect(hasPermission(member, ['role-2', 'role-3'])).toBe(true);
  });
});

describe('isModeratorOrAdmin', () => {
  it('should return true for Administrator permission', () => {
    const member = createMockMember([], [PermissionsBitField.Flags.Administrator]);
    expect(isModeratorOrAdmin(member)).toBe(true);
  });

  it('should return true for ModerateMembers permission', () => {
    const member = createMockMember([], [PermissionsBitField.Flags.ModerateMembers]);
    expect(isModeratorOrAdmin(member)).toBe(true);
  });

  it('should return false without admin/mod permissions', () => {
    const member = createMockMember([], [PermissionsBitField.Flags.SendMessages]);
    expect(isModeratorOrAdmin(member)).toBe(false);
  });

  it('should return true when member has both admin and mod', () => {
    const member = createMockMember([], [
      PermissionsBitField.Flags.Administrator,
      PermissionsBitField.Flags.ModerateMembers,
    ]);
    expect(isModeratorOrAdmin(member)).toBe(true);
  });
});

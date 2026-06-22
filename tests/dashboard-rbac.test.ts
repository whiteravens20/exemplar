import { describe, it, expect } from 'vitest';
import { evaluateAccess } from '../src/api/dashboard/rbac.js';

const base = {
  isOwner: false,
  hasAdmin: false,
  hasManageGuild: false,
  memberRoleIds: [] as string[],
  allowedRoles: [] as string[],
};

describe('evaluateAccess', () => {
  it('grants the guild owner', () => {
    expect(evaluateAccess({ ...base, isOwner: true })).toEqual({
      authorized: true,
      isAdmin: true,
    });
  });

  it('grants Administrator', () => {
    expect(evaluateAccess({ ...base, hasAdmin: true })).toEqual({
      authorized: true,
      isAdmin: true,
    });
  });

  it('grants Manage Server', () => {
    expect(evaluateAccess({ ...base, hasManageGuild: true })).toEqual({
      authorized: true,
      isAdmin: true,
    });
  });

  it('grants an allowed-role holder but not as admin', () => {
    expect(
      evaluateAccess({
        ...base,
        memberRoleIds: ['r1', 'r2'],
        allowedRoles: ['r2'],
      })
    ).toEqual({ authorized: true, isAdmin: false });
  });

  it('denies a member with no matching role or permission', () => {
    expect(
      evaluateAccess({
        ...base,
        memberRoleIds: ['r9'],
        allowedRoles: ['r1', 'r2'],
      })
    ).toEqual({ authorized: false, isAdmin: false });
  });

  it('denies when no allowed roles are configured and no permissions held', () => {
    expect(evaluateAccess({ ...base, memberRoleIds: ['r1'] })).toEqual({
      authorized: false,
      isAdmin: false,
    });
  });
});

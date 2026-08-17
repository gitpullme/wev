import { describe, it, expect, vi } from 'vitest';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken, hashToken } from '../src/services/authService.js';
import jwt from 'jsonwebtoken';

vi.mock('../src/db/client.js', () => {
  return {
    db: {
      insert: vi.fn(),
      update: vi.fn(),
      query: {
        refreshTokens: { findFirst: vi.fn() },
        users: { findFirst: vi.fn() }
      }
    }
  };
});

describe('authService', () => {
  process.env.JWT_ACCESS_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-secret-refresh';

  it('hashPassword + verifyPassword: Hash and verify password', async () => {
    const hash = await hashPassword('password123');
    expect(hash).not.toBe('password123');
    const isValid = await verifyPassword(hash, 'password123');
    expect(isValid).toBe(true);
    const isInvalid = await verifyPassword(hash, 'wrongpassword');
    expect(isInvalid).toBe(false);
  });

  it('generateAccessToken: Returns a JWT with correct sub and role claims', () => {
    const token = generateAccessToken({ id: 'user-1', role: 'HOST' });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.role).toBe('HOST');
  });

  it('verifyAccessToken: Verifies valid token; throws on invalid token', () => {
    const token = generateAccessToken({ id: 'user-2', role: 'GUEST' });
    expect(() => verifyAccessToken(token)).not.toThrow();
    expect(() => verifyAccessToken('invalid.token.str')).toThrow();
  });

  it('generateRefreshToken: Returns JWT with sub and familyId claims', () => {
    const token = generateRefreshToken({ id: 'user-3', familyId: 'fam-123' });
    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe('user-3');
    expect(decoded.familyId).toBe('fam-123');
  });

  it('hashToken: SHA-256 hash is deterministic', () => {
    const hash1 = hashToken('token-abc');
    const hash2 = hashToken('token-abc');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('Token expiry claims: Access token 15m, Refresh token 7d', () => {
    const access = generateAccessToken({ id: 'u', role: 'GUEST' });
    const refresh = generateRefreshToken({ id: 'u', familyId: 'f' });

    const decodedAccess = jwt.decode(access) as any;
    const decodedRefresh = jwt.decode(refresh) as any;

    const accessExpiryDiff = decodedAccess.exp - decodedAccess.iat;
    expect(accessExpiryDiff).toBe(15 * 60); // 15m in seconds

    const refreshExpiryDiff = decodedRefresh.exp - decodedRefresh.iat;
    expect(refreshExpiryDiff).toBe(7 * 24 * 60 * 60); // 7d in seconds
  });
});

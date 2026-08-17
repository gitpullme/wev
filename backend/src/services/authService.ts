import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { db } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secret';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function generateAccessToken(user: { id: string; role: string }): string {
  return jwt.sign({ sub: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(user: { id: string; familyId: string }): string {
  return jwt.sign({ sub: user.id, familyId: user.familyId }, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): { sub: string; role: string } {
  return jwt.verify(token, ACCESS_SECRET) as { sub: string; role: string };
}

export function verifyRefreshToken(token: string): { sub: string; familyId: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string; familyId: string };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function generateTokenPair(user: { id: string; role: string }) {
  const familyId = randomUUID();
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken({ id: user.id, familyId });
  const tokenHash = hashToken(refreshToken);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    familyId,
    expiresAt,
  });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(oldRefreshToken: string) {
  let decoded;
  try {
    decoded = verifyRefreshToken(oldRefreshToken);
  } catch (err) {
    throw new Error('Invalid refresh token');
  }

  const tokenHash = hashToken(oldRefreshToken);
  const tokenRecord = await db.query.refreshTokens.findFirst({
    where: (rt, { eq }) => eq(rt.tokenHash, tokenHash),
  });

  if (!tokenRecord) {
    throw new Error('Refresh token not found');
  }

  if (tokenRecord.revoked) {
    // Reuse detected, revoke whole family
    await db.update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.familyId, decoded.familyId));
    throw new Error('Token reuse detected');
  }

  // Revoke old token
  await db.update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.id, tokenRecord.id));

  // Generate new tokens, SAME family
  // Fetch user to get current role (it may have changed since token was issued)
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, decoded.sub) });
  if (!user) throw new Error('User not found');

  const newAccessToken = generateAccessToken({ id: user.id, role: user.role });
  const newRefreshToken = generateRefreshToken({ id: user.id, familyId: decoded.familyId });
  const newTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newTokenHash,
    familyId: decoded.familyId,
    expiresAt,
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

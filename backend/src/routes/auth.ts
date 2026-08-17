import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users, refreshTokens } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, generateTokenPair, rotateRefreshToken } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
});

router.post('/register', async (req, res) => {
  const { email, password, displayName } = registerSchema.parse(req.body);

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    res.status(409).json({ error: 'CONFLICT', message: 'Email already exists' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({
    email,
    passwordHash,
    displayName,
    role: 'GUEST',
  }).returning();

  const { accessToken, refreshToken } = await generateTokenPair(user);

  res.status(201).json({
    data: {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      accessToken,
      refreshToken
    }
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
    return;
  }

  const { accessToken, refreshToken } = await generateTokenPair(user);

  res.json({
    data: {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      accessToken,
      refreshToken
    }
  });
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);

  try {
    const tokens = await rotateRefreshToken(refreshToken);
    res.json({ data: tokens });
  } catch (err: any) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: err.message });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  await db.update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.userId, req.user!.id));

  res.json({ data: { message: 'Logged out' } });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.user!.id) });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    return;
  }
  
  res.json({
    data: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt
    }
  });
});

export default router;

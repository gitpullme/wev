import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { generateAccessToken, generateRefreshToken } from '../src/services/authService.js';
import jwt from 'jsonwebtoken';

const { dbMock } = vi.hoisted(() => {
  return {
    dbMock: {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'act-1' }]) }) }),
      query: {
        refreshTokens: { findFirst: vi.fn() },
        users: { findFirst: vi.fn() }
      },
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
    }
  };
});

vi.mock('../src/db/client.js', () => ({
  db: dbMock
}));

describe('RBAC & Auth Middleware', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-secret-refresh';
    vi.clearAllMocks();
  });

  it('Guest token -> POST /api/sports/activities -> 403', async () => {
    const guestToken = generateAccessToken({ id: 'u1', role: 'GUEST' });
    const res = await request(app)
      .post('/api/sports/activities')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        title: 'Football',
        sportType: 'FOOTBALL',
        location: 'Park',
        latitude: 0,
        longitude: 0,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        capacity: 10
      });
    expect(res.status).toBe(403);
  });

  it('No token -> any protected route -> 401', async () => {
    const r1 = await request(app).get('/api/care/providers');
    expect(r1.status).toBe(401);
    
    const r2 = await request(app).get('/api/sports/bookings');
    expect(r2.status).toBe(401);
    
    const r3 = await request(app).get('/api/auth/me');
    expect(r3.status).toBe(401);
  });

  it('Expired token -> 401', async () => {
    // using jwt.sign with expiresIn: -1s to ensure it is immediately expired
    const expiredToken = jwt.sign({ sub: 'u1', role: 'HOST' }, 'test-secret', { expiresIn: '-1s' });
    const res = await request(app)
      .post('/api/sports/activities')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({});
    expect(res.status).toBe(401);
  });

  it('Valid HOST token -> POST /api/sports/activities -> 201', async () => {
    const hostToken = generateAccessToken({ id: 'u1', role: 'HOST' });
    const res = await request(app)
      .post('/api/sports/activities')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Football',
        sportType: 'FOOTBALL',
        location: 'Park',
        latitude: 0,
        longitude: 0,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        capacity: 10
      });
    expect(res.status).toBe(201);
  });

  it('Token reuse detection', async () => {
    const refreshToken = generateRefreshToken({ id: 'u1', familyId: 'f1' });
    
    // Mock finding a revoked token
    dbMock.query.refreshTokens.findFirst.mockResolvedValueOnce({
      id: 'rt-1',
      tokenHash: 'hash',
      familyId: 'f1',
      revoked: true
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });
});

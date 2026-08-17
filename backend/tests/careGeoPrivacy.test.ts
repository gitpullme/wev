import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { generateAccessToken } from '../src/services/authService.js';

const { dbMock } = vi.hoisted(() => {
  const mockDbProviders = [
    {
      id: 'p1',
      name: 'Provider 1',
      serviceType: 'BABYSITTER',
      exactLat: 37.7749,
      exactLng: -122.4194,
      address: '123 Exact Street, SF',
      obfuscationSeed: 12345
    }
  ];

  const mockDbBookings = [
    {
      booking: { id: 'b1', status: 'PENDING', providerId: 'p1', userId: 'u1' },
      provider: mockDbProviders[0]
    },
    {
      booking: { id: 'b2', status: 'CONFIRMED', providerId: 'p1', userId: 'u1' },
      provider: mockDbProviders[0]
    }
  ];

  return {
    dbMock: {
      select: vi.fn((opts) => {
        return {
          from: vi.fn((table) => {
            if (table && table.id && typeof table.id.name === 'string' && table.id.name === 'id') {
               // roughly checking for table object
            }
            
            // To be safe, we just check if it's the bookings route by a hack or just always return a robust builder
            const builder: any = Promise.resolve(mockDbProviders);
            
            builder.innerJoin = vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockDbBookings)
            });
            
            // Override where to return different data based on what was joined or just the mockDbBookings if joined
            builder.where = vi.fn().mockResolvedValue(mockDbProviders);
            
            return builder;
          })
        };
      }),
      query: {
        careProviders: {
          findFirst: vi.fn().mockResolvedValue(mockDbProviders[0])
        }
      }
    }
  };
});

vi.mock('../src/db/client.js', () => ({
  db: dbMock
}));

describe('Care Geo-Privacy', () => {
  let token: string;
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    token = generateAccessToken({ id: 'u1', role: 'GUEST' });
  });

  it('Unauthenticated access -> 401', async () => {
    const res = await request(app).get('/api/care/providers');
    expect(res.status).toBe(401);
  });

  it('Provider list never exposes exact coords', async () => {
    const res = await request(app)
      .get('/api/care/providers')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const p = res.body.data[0];
    expect(p.exactLat).toBeUndefined();
    expect(p.exactLng).toBeUndefined();
    expect(p.address).toBeUndefined();
    expect(p.lat).toBeDefined();
    expect(p.lng).toBeDefined();
  });

  it('Provider detail never exposes exact coords', async () => {
    const res = await request(app)
      .get('/api/care/providers/p1')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    const p = res.body.data;
    expect(p.exactLat).toBeUndefined();
    expect(p.exactLng).toBeUndefined();
    expect(p.address).toBeUndefined();
    expect(p.lat).toBeDefined();
    expect(p.lng).toBeDefined();
  });

  it('PENDING booking hides address', async () => {
    // we mocked /bookings to return two bookings, one pending, one confirmed
    const res = await request(app)
      .get('/api/care/bookings')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    const pendingBooking = res.body.data.find((d: any) => d.booking.status === 'PENDING');
    expect(pendingBooking.provider.address).toBeUndefined();
    expect(pendingBooking.provider.exactLat).toBeUndefined();
    expect(pendingBooking.provider.exactLng).toBeUndefined();
    expect(pendingBooking.provider.lat).toBeDefined();
  });

  it('CONFIRMED booking reveals address', async () => {
    const res = await request(app)
      .get('/api/care/bookings')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    const confirmedBooking = res.body.data.find((d: any) => d.booking.status === 'CONFIRMED');
    expect(confirmedBooking.provider.address).toBe('123 Exact Street, SF');
    expect(confirmedBooking.provider.exactLat).toBe(37.7749);
    expect(confirmedBooking.provider.exactLng).toBe(-122.4194);
  });
});

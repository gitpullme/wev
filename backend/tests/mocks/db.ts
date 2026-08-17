import { vi } from 'vitest';

export const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn() }) }),
  update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn() }) }) }),
  transaction: vi.fn(async (cb) => {
    return cb(mockDb); // pass itself as tx
  }),
  query: {
    users: { findFirst: vi.fn() },
    refreshTokens: { findFirst: vi.fn() },
    careProviders: { findFirst: vi.fn() },
    careBookings: { findFirst: vi.fn() },
    sportsActivities: { findFirst: vi.fn() },
    sportsBookings: { findFirst: vi.fn() },
  },
  for: vi.fn().mockReturnThis()
};

export const db = mockDb;

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { careProviders, careBookings } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { obfuscateLocation, obfuscatedDistance } from '../services/geoObfuscation.js';

const router = Router();

// ── List all care providers (obfuscated location always) ─────────────────────
router.get('/providers', requireAuth, async (req, res) => {
  const { serviceType, userLat, userLng } = req.query;

  const lat = parseFloat(userLat as string);
  const lng = parseFloat(userLng as string);

  // Build query with optional serviceType filter
  const providers = serviceType
    ? await db.select().from(careProviders).where(eq(careProviders.serviceType, serviceType as string))
    : await db.select().from(careProviders);

  const mapped = providers.map(p => {
    const obf = obfuscateLocation(p.exactLat, p.exactLng, p.obfuscationSeed);
    const dist = (!isNaN(lat) && !isNaN(lng))
      ? obfuscatedDistance(p.exactLat, p.exactLng, lat, lng, p.obfuscationSeed)
      : undefined;

    return {
      id: p.id,
      name: p.name,
      serviceType: p.serviceType,
      bio: p.bio,
      hourlyRate: p.hourlyRate,
      verified: p.verified,
      lat: obf.lat,
      lng: obf.lng,
      distance: dist,
      // exactLat, exactLng, address are NEVER included here
    };
  });

  // Sort by obfuscated distance — prevents exact distance triangulation
  mapped.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

  res.json({ data: mapped });
});

// ── Single provider (obfuscated) ─────────────────────────────────────────────
router.get('/providers/:id', requireAuth, async (req, res) => {
  const providerId = req.params['id'] as string;

  const provider = await db.query.careProviders.findFirst({
    where: (tbl, { eq: eqFn }) => eqFn(tbl.id, providerId),
  });

  if (!provider) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Provider not found' });
    return;
  }

  const obf = obfuscateLocation(provider.exactLat, provider.exactLng, provider.obfuscationSeed);

  res.json({
    data: {
      id: provider.id,
      name: provider.name,
      serviceType: provider.serviceType,
      bio: provider.bio,
      hourlyRate: provider.hourlyRate,
      verified: provider.verified,
      lat: obf.lat,
      lng: obf.lng,
      // address: NEVER included
    },
  });
});

// ── Create booking (PENDING status) ──────────────────────────────────────────
const bookSchema = z.object({
  providerId: z.string().uuid(),
  startTime: z.string().transform(str => new Date(str)),
  endTime: z.string().transform(str => new Date(str)),
  clientId: z.string().optional(),
});

router.post('/bookings', requireAuth, async (req, res) => {
  const parsed = bookSchema.parse(req.body);
  const userId = req.user!.id;

  // Idempotency: return existing booking if clientId matches
  if (parsed.clientId) {
    const existing = await db.query.careBookings.findFirst({
      where: (tbl, { and: andFn, eq: eqFn }) =>
        andFn(eqFn(tbl.userId, userId), eqFn(tbl.clientId, parsed.clientId!)),
    });
    if (existing) {
      res.json({ data: existing });
      return;
    }
  }

  const [booking] = await db.insert(careBookings).values({
    userId,
    providerId: parsed.providerId,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    clientId: parsed.clientId,
    status: 'PENDING',
  }).returning();

  res.status(201).json({ data: booking });
});

// ── List user's bookings ──────────────────────────────────────────────────────
router.get('/bookings', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const bookings = await db.select({
    booking: careBookings,
    provider: careProviders,
  }).from(careBookings)
    .innerJoin(careProviders, eq(careBookings.providerId, careProviders.id))
    .where(eq(careBookings.userId, userId));

  const mapped = bookings.map(b => {
    // GEO-PRIVACY: exact address only on CONFIRMED bookings
    if (b.booking.status === 'CONFIRMED') {
      return {
        booking: b.booking,
        provider: {
          id: b.provider.id,
          name: b.provider.name,
          serviceType: b.provider.serviceType,
          exactLat: b.provider.exactLat,
          exactLng: b.provider.exactLng,
          address: b.provider.address,      // ← revealed only on CONFIRMED
        },
      };
    } else {
      const obf = obfuscateLocation(b.provider.exactLat, b.provider.exactLng, b.provider.obfuscationSeed);
      return {
        booking: b.booking,
        provider: {
          id: b.provider.id,
          name: b.provider.name,
          serviceType: b.provider.serviceType,
          lat: obf.lat,
          lng: obf.lng,
          // address: NEVER included for non-confirmed
        },
      };
    }
  });

  res.json({ data: mapped });
});

// ── Confirm booking (HOST/ADMIN) → reveals exact address ─────────────────────
router.patch('/bookings/:id/confirm', requireAuth, requireRole('HOST', 'ADMIN'), async (req, res) => {
  const bookingId = req.params['id'] as string;

  const [booking] = await db.update(careBookings)
    .set({ status: 'CONFIRMED' })
    .where(eq(careBookings.id, bookingId))
    .returning();

  if (!booking) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Booking not found' });
    return;
  }

  const provider = await db.query.careProviders.findFirst({
    where: (tbl, { eq: eqFn }) => eqFn(tbl.id, booking.providerId),
  });

  res.json({
    data: {
      booking,
      provider: {
        address: provider!.address,
        exactLat: provider!.exactLat,
        exactLng: provider!.exactLng,
      },
    },
  });
});

// ── Cancel booking ────────────────────────────────────────────────────────────
router.patch('/bookings/:id/cancel', requireAuth, async (req, res) => {
  const bookingId = req.params['id'] as string;
  const userId = req.user!.id;

  const [booking] = await db.update(careBookings)
    .set({ status: 'CANCELLED' })
    .where(and(eq(careBookings.id, bookingId), eq(careBookings.userId, userId)))
    .returning();

  if (!booking) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Booking not found' });
    return;
  }

  // Return with obfuscated location only
  const provider = await db.query.careProviders.findFirst({
    where: (tbl, { eq: eqFn }) => eqFn(tbl.id, booking.providerId),
  });

  const obf = provider
    ? obfuscateLocation(provider.exactLat, provider.exactLng, provider.obfuscationSeed)
    : null;

  res.json({
    data: {
      booking,
      provider: obf ? { lat: obf.lat, lng: obf.lng } : null,
    },
  });
});

export default router;

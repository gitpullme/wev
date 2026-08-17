import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { sportsActivities, sportsBookings } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/activities', async (req, res) => {
  const sportType = req.query.sportType as string;

  let query = db.select().from(sportsActivities).where(sql`${sportsActivities.capacity} > ${sportsActivities.bookedCount}`);
  
  if (sportType) {
    query = db.select().from(sportsActivities).where(and(
      sql`${sportsActivities.capacity} > ${sportsActivities.bookedCount}`,
      eq(sportsActivities.sportType, sportType)
    ));
  }

  const activities = await query;
  res.json({ data: activities });
});

router.get('/activities/:id', async (req, res) => {
  const activity = await db.query.sportsActivities.findFirst({
    where: eq(sportsActivities.id, req.params.id)
  });
  
  if (!activity) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Activity not found' });
    return;
  }
  
  res.json({ data: activity });
});

const createActivitySchema = z.object({
  title: z.string(),
  sportType: z.string(),
  description: z.string().optional(),
  location: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  startTime: z.string().transform(str => new Date(str)),
  endTime: z.string().transform(str => new Date(str)),
  capacity: z.number().int().positive(),
});

router.post('/activities', requireAuth, requireRole('HOST', 'ADMIN'), async (req, res) => {
  const parsed = createActivitySchema.parse(req.body);

  const [activity] = await db.insert(sportsActivities).values({
    ...parsed,
    createdBy: req.user!.id,
  }).returning();

  res.status(201).json({ data: activity });
});

const createBookingSchema = z.object({
  activityId: z.string().uuid(),
  clientId: z.string().optional(),
});

router.post('/bookings', requireAuth, async (req, res) => {
  const { activityId, clientId } = createBookingSchema.parse(req.body);
  const userId = req.user!.id;

  // Idempotency: if clientId matches an existing booking, return it
  if (clientId) {
    const existing = await db.query.sportsBookings.findFirst({
      where: and(eq(sportsBookings.userId, userId), eq(sportsBookings.clientId, clientId))
    });
    if (existing) {
      res.json({ data: existing });
      return;
    }
  }

  // Transactional booking with row-level lock for capacity safety
  const result = await db.transaction(async (tx) => {
    const [activity] = await tx.select().from(sportsActivities).where(eq(sportsActivities.id, activityId)).for('update');
    
    if (!activity) {
      return { conflict: false, notFound: true } as const;
    }
    if ((activity.bookedCount ?? 0) >= activity.capacity) {
      return { conflict: true, notFound: false } as const;
    }

    await tx.update(sportsActivities)
      .set({ bookedCount: (activity.bookedCount ?? 0) + 1 })
      .where(eq(sportsActivities.id, activityId));

    const [booking] = await tx.insert(sportsBookings).values({
      userId,
      activityId,
      clientId,
      status: 'CONFIRMED',
      syncedAt: new Date(),
    }).returning();

    return { conflict: false, notFound: false, booking } as const;
  });

  if (result.notFound) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Activity not found' });
    return;
  }
  if (result.conflict) {
    res.status(409).json({ error: 'CONFLICT', message: 'Activity is fully booked' });
    return;
  }

  res.status(201).json({ data: result.booking });
});

router.get('/bookings', requireAuth, async (req, res) => {
  const bookings = await db.select({
    booking: sportsBookings,
    activity: sportsActivities
  }).from(sportsBookings)
    .innerJoin(sportsActivities, eq(sportsBookings.activityId, sportsActivities.id))
    .where(eq(sportsBookings.userId, req.user!.id));

  res.json({ data: bookings });
});

export default router;

import { Router } from 'express';
import { db } from '../db/client.js';
import { events } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  const allEvents = await db.select().from(events);
  res.json({ data: allEvents });
});

router.get('/:id', async (req, res) => {
  const event = await db.query.events.findFirst({
    where: eq(events.id, req.params.id)
  });

  if (!event) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Event not found' });
    return;
  }

  res.json({ data: event });
});

export default router;

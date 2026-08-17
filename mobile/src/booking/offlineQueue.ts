// src/booking/offlineQueue.ts
// Persistent offline queue backed by AsyncStorage.
// When the user books while offline, the booking is queued here.
// On reconnect, the queue is drained in FIFO order.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuid } from 'uuid';

const QUEUE_KEY = 'wev:offline_booking_queue';

export interface QueuedBooking {
  /** Unique ID for this queue entry */
  queueId: string;
  /** 'sports' or 'care' — determines which API endpoint to call */
  miniAppType: 'sports' | 'care';
  /** The booking payload to send to the server */
  payload: Record<string, unknown>;
  /** Client-generated ID for idempotency */
  clientId: string;
  /** ISO timestamp when this was queued */
  queuedAt: string;
}

/**
 * Add a booking to the offline queue.
 */
export async function enqueueBooking(
  miniAppType: 'sports' | 'care',
  payload: Record<string, unknown>,
): Promise<QueuedBooking> {
  const entry: QueuedBooking = {
    queueId: uuid(),
    miniAppType,
    payload: { ...payload, clientId: payload.clientId || uuid() },
    clientId: (payload.clientId as string) || uuid(),
    queuedAt: new Date().toISOString(),
  };

  const queue = await getQueue();
  queue.push(entry);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

  return entry;
}

/**
 * Get all queued bookings in FIFO order.
 */
export async function getQueue(): Promise<QueuedBooking[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedBooking[];
  } catch {
    return [];
  }
}

/**
 * Remove a specific entry from the queue (after successful sync).
 */
export async function dequeueBooking(queueId: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.filter((entry) => entry.queueId !== queueId);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

/**
 * Clear the entire queue. Use after bulk sync or for testing.
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/**
 * Get the number of queued bookings.
 */
export async function queueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

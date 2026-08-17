// src/booking/useOfflineAwareBooking.ts
// Composed hook that wires together:
//   - Booking state machine (pure state transitions)
//   - Offline queue (AsyncStorage persistence)
//   - TanStack Query mutation (network call + optimistic UI)
//   - Network status (online/offline detection)
//
// Both Sports and Care consume this — shared repository layer, not copy-paste.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api } from '../services/api';
import {
  BookingStatus,
  transition,
  statusLabel,
} from './bookingStateMachine';
import {
  enqueueBooking,
  getQueue,
  dequeueBooking,
  QueuedBooking,
} from './offlineQueue';
import { checkIsOnline, useNetworkStatus } from '../utils/networkStatus';

interface UseOfflineAwareBookingOptions {
  /** 'sports' or 'care' — determines the API endpoint */
  miniAppType: 'sports' | 'care';
  /** TanStack Query cache key to invalidate on success */
  queryKey: string[];
}

interface BookingResult {
  /** Current booking state */
  status: BookingStatus;
  /** Human-readable label */
  label: string;
  /** Trigger a booking */
  book: (payload: Record<string, unknown>) => Promise<void>;
  /** Reset state for a new booking */
  reset: () => void;
  /** Whether the device is online */
  isOnline: boolean;
  /** Whether a sync is in progress */
  isSyncing: boolean;
  /** Number of queued bookings */
  queueCount: number;
}

/**
 * Offline-aware booking hook.
 *
 * Online flow:  IDLE → QUEUED → SYNCING → SUCCESS
 * Offline flow: IDLE → QUEUED (persisted) ... reconnect → SYNCING → SUCCESS | CONFLICT_REJECTED
 * Conflict:     SYNCING → CONFLICT_REJECTED (UI rolls back, user notified)
 */
export function useOfflineAwareBooking({
  miniAppType,
  queryKey,
}: UseOfflineAwareBookingOptions): BookingResult {
  const [status, setStatus] = useState<BookingStatus>('IDLE');
  const [queueCount, setQueueCount] = useState(0);
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const isSyncingRef = useRef(false);

  // Resolve the API endpoint based on mini-app type
  const endpoint =
    miniAppType === 'sports'
      ? '/api/sports/bookings'
      : '/api/care/bookings';

  // ── Mutation: send booking to server ─────────────────────────
  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post(endpoint, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // ── Sync queued bookings on reconnect ────────────────────────
  const syncQueue = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const queue = await getQueue();
      const relevant = queue.filter((q) => q.miniAppType === miniAppType);

      for (const entry of relevant) {
        setStatus(transition('QUEUED', 'SYNC_START'));

        try {
          await api.post(endpoint, entry.payload);
          await dequeueBooking(entry.queueId);
          setStatus(transition('SYNCING', 'SYNC_SUCCESS'));
        } catch (err: any) {
          if (err?.response?.status === 409) {
            // Conflict: slot was taken
            await dequeueBooking(entry.queueId);
            setStatus(transition('SYNCING', 'CONFLICT'));
            Alert.alert(
              'Booking Conflict',
              'This slot is no longer available. Your booking has been rejected.',
              [{ text: 'OK' }],
            );
          } else {
            // Network error or server error — leave in queue for next try
            console.error('[OfflineBooking] Sync failed:', err);
            setStatus('QUEUED');
            break;
          }
        }
      }

      // Refresh queue count
      const remaining = await getQueue();
      setQueueCount(remaining.filter((q) => q.miniAppType === miniAppType).length);

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey });
    } finally {
      isSyncingRef.current = false;
    }
  }, [miniAppType, endpoint, queryClient, queryKey]);

  // ── Auto-sync when coming back online ────────────────────────
  useEffect(() => {
    if (isOnline) {
      syncQueue();
    }
  }, [isOnline, syncQueue]);

  // ── Load queue count on mount ────────────────────────────────
  useEffect(() => {
    getQueue().then((q) => {
      setQueueCount(q.filter((entry) => entry.miniAppType === miniAppType).length);
    });
  }, [miniAppType]);

  // ── Book: the main entry point ───────────────────────────────
  const book = useCallback(
    async (payload: Record<string, unknown>) => {
      // Transition: IDLE → QUEUED
      setStatus(transition('IDLE', 'SUBMIT'));

      const online = await checkIsOnline();

      if (online) {
        // Online: immediately sync
        setStatus(transition('QUEUED', 'SYNC_START'));

        try {
          await mutation.mutateAsync(payload);
          setStatus(transition('SYNCING', 'SYNC_SUCCESS'));
        } catch (err: any) {
          if (err?.response?.status === 409) {
            setStatus(transition('SYNCING', 'CONFLICT'));
            Alert.alert(
              'Booking Conflict',
              'This slot is no longer available. Please try a different time.',
              [{ text: 'OK' }],
            );
          } else {
            // Unexpected error — queue for retry
            await enqueueBooking(miniAppType, payload);
            setStatus('QUEUED');
            const q = await getQueue();
            setQueueCount(q.filter((e) => e.miniAppType === miniAppType).length);
          }
        }
      } else {
        // Offline: persist to queue
        await enqueueBooking(miniAppType, payload);
        const q = await getQueue();
        setQueueCount(q.filter((e) => e.miniAppType === miniAppType).length);
        // Status stays QUEUED — UI shows "Pending Sync ⏳"
      }
    },
    [miniAppType, mutation, endpoint],
  );

  const reset = useCallback(() => {
    setStatus(transition(status, 'RESET'));
  }, [status]);

  return {
    status,
    label: statusLabel(status),
    book,
    reset,
    isOnline,
    isSyncing: status === 'SYNCING',
    queueCount,
  };
}

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
import { useNetworkOverrideStore } from '../stores/networkOverrideStore';

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
  /** Trigger a booking (checks online, routes accordingly) */
  book: (payload: Record<string, unknown>) => Promise<void>;
  /** Reset state for a new booking */
  reset: () => void;
  /** Force-drain the offline queue (bypasses isSyncing lock) */
  forceSync: () => Promise<void>;
  /** Directly enqueue a booking to AsyncStorage and set status=QUEUED.
   *  Bypasses checkIsOnline/mutation — used by conflict demo on Android. */
  enqueueDirectly: (payload: Record<string, unknown>) => Promise<void>;
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
  const suppressAutoSyncRef = useRef(false); // Set by forceSync to prevent double-drain on Android

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
    // Don't sync if still in simulated offline mode
    const { simulatedOffline } = useNetworkOverrideStore.getState();
    if (simulatedOffline) {
      console.log('[OfflineBooking] syncQueue skipped: still simulated offline');
      return;
    }
    if (isSyncingRef.current) {
      console.log('[OfflineBooking] syncQueue skipped: already syncing');
      return;
    }

    // Guard: only proceed if there are actually items in the queue
    const preCheck = await getQueue();
    const relevant = preCheck.filter((q) => q.miniAppType === miniAppType);
    if (relevant.length === 0) {
      console.log('[OfflineBooking] syncQueue skipped: no items in queue for', miniAppType);
      return;
    }

    console.log(`[OfflineBooking] syncQueue: draining ${relevant.length} item(s) for ${miniAppType}`);
    isSyncingRef.current = true;

    try {
      for (const entry of relevant) {
        // Force status to SYNCING
        setStatus('SYNCING');
        console.log('[OfflineBooking] → SYNCING, posting to', endpoint);

        try {
          await api.post(endpoint, entry.payload);
          await dequeueBooking(entry.queueId);
          console.log('[OfflineBooking] → SUCCESS');
          setStatus('SUCCESS');
        } catch (err: any) {
          const httpStatus = err?.response?.status;
          console.log('[OfflineBooking] POST failed with status:', httpStatus);

          if (httpStatus === 409) {
            await dequeueBooking(entry.queueId);
            console.log('[OfflineBooking] → CONFLICT_REJECTED');
            setStatus('CONFLICT_REJECTED');
            Alert.alert(
              '⚠️ Booking Conflict',
              'Another user booked this slot while you were offline. Your booking has been rolled back.',
              [{ text: 'OK' }],
            );
          } else {
            // Network error or server error — leave in queue for next try
            console.error('[OfflineBooking] Sync failed:', err?.message || err);
            setStatus('QUEUED');
            break;
          }
        }
      }

      const remaining = await getQueue();
      setQueueCount(remaining.filter((q) => q.miniAppType === miniAppType).length);
      queryClient.invalidateQueries({ queryKey });
    } finally {
      isSyncingRef.current = false;
    }
  }, [miniAppType, endpoint, queryClient, queryKey]);

  // ── Auto-sync when coming back online ────────────────────────
  // Suppressed when forceSync is running to prevent double-drain on Android.
  useEffect(() => {
    if (isOnline && !suppressAutoSyncRef.current) {
      const t = setTimeout(() => {
        if (!suppressAutoSyncRef.current) {
          console.log('[OfflineBooking] isOnline changed to true → auto syncQueue');
          syncQueue();
        }
      }, 400);
      return () => clearTimeout(t);
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
      setStatus('QUEUED');

      const online = await checkIsOnline();
      console.log('[OfflineBooking] book() called, online =', online);

      if (online) {
        setStatus('SYNCING');
        try {
          await mutation.mutateAsync(payload);
          setStatus('SUCCESS');
        } catch (err: any) {
          if (err?.response?.status === 409) {
            setStatus('CONFLICT_REJECTED');
            Alert.alert(
              '⚠️ Booking Conflict',
              'This slot is no longer available. Please try a different time.',
              [{ text: 'OK' }],
            );
          } else {
            await enqueueBooking(miniAppType, payload);
            setStatus('QUEUED');
            const q = await getQueue();
            setQueueCount(q.filter((e) => e.miniAppType === miniAppType).length);
          }
        }
      } else {
        console.log('[OfflineBooking] Offline → enqueueing booking');
        await enqueueBooking(miniAppType, payload);
        const q = await getQueue();
        setQueueCount(q.filter((e) => e.miniAppType === miniAppType).length);
      }
    },
    [miniAppType, mutation, endpoint],
  );

  // ── Force sync — used by conflict demo button ─────────────────
  // Suppresses the reactive auto-sync for 2s, resets the lock, then drains.
  const forceSync = useCallback(async () => {
    console.log('[OfflineBooking] forceSync() called — suppressing auto-sync for 2s');
    suppressAutoSyncRef.current = true;
    isSyncingRef.current = false; // Reset lock so we can proceed
    await syncQueue();
    // Re-enable auto-sync after 2 seconds
    setTimeout(() => {
      suppressAutoSyncRef.current = false;
    }, 2000);
  }, [syncQueue]);

  const reset = useCallback(() => {
    setStatus('IDLE');
  }, []);

  // ── Direct enqueue — bypasses checkIsOnline + mutation entirely ────
  // Used by the conflict demo to avoid Android timing issues with book().
  const enqueueDirectly = useCallback(
    async (payload: Record<string, unknown>) => {
      console.log('[OfflineBooking] enqueueDirectly: writing to AsyncStorage');
      await enqueueBooking(miniAppType, payload);
      setStatus('QUEUED');
      const q = await getQueue();
      setQueueCount(q.filter((e) => e.miniAppType === miniAppType).length);
      console.log('[OfflineBooking] enqueueDirectly: done, status=QUEUED, queueCount=', q.length);
    },
    [miniAppType],
  );

  return {
    status,
    label: statusLabel(status),
    book,
    reset,
    forceSync,
    enqueueDirectly,
    isOnline,
    isSyncing: status === 'SYNCING',
    queueCount,
  };
}


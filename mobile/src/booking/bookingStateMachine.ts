// src/booking/bookingStateMachine.ts
// Pure function state machine for booking lifecycle.
// Shared between Sports and Care — not copy-pasted.
//
// States: IDLE → QUEUED → SYNCING → SUCCESS | CONFLICT_REJECTED
//
// This is a pure reducer — no side effects, no async, fully testable.

export type BookingStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'SYNCING'
  | 'SUCCESS'
  | 'CONFLICT_REJECTED';

export type BookingEvent =
  | 'SUBMIT'
  | 'SYNC_START'
  | 'SYNC_SUCCESS'
  | 'CONFLICT'
  | 'RETRY'
  | 'RESET';

/**
 * Transition function for the booking state machine.
 * Invalid transitions return the current state unchanged
 * (fail-safe — no crashes on unexpected events).
 */
export function transition(
  current: BookingStatus,
  event: BookingEvent,
): BookingStatus {
  switch (current) {
    case 'IDLE':
      if (event === 'SUBMIT') return 'QUEUED';
      return current;

    case 'QUEUED':
      if (event === 'SYNC_START') return 'SYNCING';
      if (event === 'RESET') return 'IDLE';
      return current;

    case 'SYNCING':
      if (event === 'SYNC_SUCCESS') return 'SUCCESS';
      if (event === 'CONFLICT') return 'CONFLICT_REJECTED';
      return current;

    case 'SUCCESS':
      if (event === 'RESET') return 'IDLE';
      return current;

    case 'CONFLICT_REJECTED':
      if (event === 'RETRY') return 'IDLE';
      if (event === 'RESET') return 'IDLE';
      return current;

    default:
      return current;
  }
}

/**
 * Human-readable label for each booking status.
 */
export function statusLabel(status: BookingStatus): string {
  switch (status) {
    case 'IDLE':
      return 'Ready';
    case 'QUEUED':
      return 'Pending Sync ⏳';
    case 'SYNCING':
      return 'Syncing...';
    case 'SUCCESS':
      return 'Confirmed ✓';
    case 'CONFLICT_REJECTED':
      return 'Slot Unavailable ✗';
  }
}

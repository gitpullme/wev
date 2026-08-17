import { describe, it, expect } from 'vitest';

describe('Booking State Machine Logic (Backend equivalent)', () => {
  // Simulating pure functions for the state machine rules
  function checkCapacity(activity: { capacity: number, bookedCount: number }) {
    if (activity.bookedCount >= activity.capacity) {
      return { allowed: false, reason: 'Activity is fully booked' };
    }
    return { allowed: true };
  }

  function handleIdempotency(clientId: string | undefined, existingBookings: any[]) {
    if (clientId) {
      const existing = existingBookings.find(b => b.clientId === clientId);
      if (existing) return existing;
    }
    return null;
  }

  function transitionStatus(currentStatus: string, action: string) {
    if (currentStatus === 'PENDING' && action === 'CONFIRM') return 'CONFIRMED';
    if (currentStatus === 'PENDING' && action === 'CANCEL') return 'CANCELLED';
    if (currentStatus === 'CONFIRMED' && action === 'CANCEL') return 'CANCELLED';
    throw new Error('Invalid transition');
  }

  it('Capacity check: If bookedCount >= capacity, booking should be rejected', () => {
    expect(checkCapacity({ capacity: 10, bookedCount: 10 }).allowed).toBe(false);
    expect(checkCapacity({ capacity: 10, bookedCount: 9 }).allowed).toBe(true);
  });

  it('Idempotency: If clientId exists, return existing booking', () => {
    const existingBookings = [{ id: 'b1', clientId: 'client-123' }];
    expect(handleIdempotency('client-123', existingBookings)).toEqual(existingBookings[0]);
    expect(handleIdempotency('client-456', existingBookings)).toBeNull();
  });

  it('Status transitions: PENDING -> CONFIRMED -> CANCELLED', () => {
    let status = 'PENDING';
    status = transitionStatus(status, 'CONFIRM');
    expect(status).toBe('CONFIRMED');
    status = transitionStatus(status, 'CANCEL');
    expect(status).toBe('CANCELLED');
    
    // Test invalid transition
    expect(() => transitionStatus('CANCELLED', 'CONFIRM')).toThrow('Invalid transition');
  });
});

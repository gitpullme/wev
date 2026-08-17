// src/stores/networkOverrideStore.ts
// Zustand store for simulating offline mode in the UI without
// needing Airplane Mode. Used for demo/testing of the offline queue,
// optimistic UI, and 409 conflict resolution.
//
// When simulatedOffline is true:
//   - useNetworkStatus() returns { isOnline: false }
//   - checkIsOnline() returns false
//   - Bookings go straight to the offline queue
//   - syncQueue() will not fire
//
// Toggling back to simulatedOffline=false triggers the auto-sync.

import { create } from 'zustand';

interface NetworkOverrideState {
  /** When true, the app behaves as if the device is offline regardless of real connectivity */
  simulatedOffline: boolean;
  /** Toggle between simulated-offline and real connectivity */
  toggleSimulatedOffline: () => void;
  /** Explicitly set the simulated offline state */
  setSimulatedOffline: (offline: boolean) => void;
}

export const useNetworkOverrideStore = create<NetworkOverrideState>((set) => ({
  simulatedOffline: false,
  toggleSimulatedOffline: () =>
    set((state) => ({ simulatedOffline: !state.simulatedOffline })),
  setSimulatedOffline: (offline) => set({ simulatedOffline: offline }),
}));

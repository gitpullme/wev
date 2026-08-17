// src/utils/networkStatus.ts
// Thin wrapper around @react-native-community/netinfo.
// Supports a "simulated offline" override from networkOverrideStore —
// when simulatedOffline is true, the device appears offline to the entire
// booking system even if real connectivity is present. This enables the
// offline queue demo without needing Airplane Mode.

import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useNetworkOverrideStore } from '../stores/networkOverrideStore';

/**
 * Hook that returns the current online/offline status.
 * Respects simulatedOffline override from networkOverrideStore.
 * Re-renders when either real connectivity OR the override changes.
 */
export function useNetworkStatus(): { isOnline: boolean; isLoading: boolean } {
  const [realOnline, setRealOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const simulatedOffline = useNetworkOverrideStore((s) => s.simulatedOffline);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setRealOnline(!!state.isConnected && state.isInternetReachable !== false);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // Simulated offline overrides real connectivity
  const isOnline = simulatedOffline ? false : realOnline;

  return { isOnline, isLoading };
}

/**
 * Imperative check — returns true if the device currently has network
 * connectivity AND is not in simulated-offline mode.
 * Use this in non-hook contexts (e.g. inside useOfflineAwareBooking).
 */
export async function checkIsOnline(): Promise<boolean> {
  // Read override directly from Zustand store state (outside React)
  const { simulatedOffline } = useNetworkOverrideStore.getState();
  if (simulatedOffline) return false;

  const state = await NetInfo.fetch();
  return !!state.isConnected && state.isInternetReachable !== false;
}

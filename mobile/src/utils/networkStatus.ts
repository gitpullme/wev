// src/utils/networkStatus.ts
// Thin wrapper around @react-native-community/netinfo.
// Provides a reactive hook and an imperative check for online status.

import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Hook that returns the current online/offline status.
 * Re-renders when connectivity changes.
 */
export function useNetworkStatus(): { isOnline: boolean; isLoading: boolean } {
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  return { isOnline, isLoading };
}

/**
 * Imperative check — returns true if the device currently has
 * network connectivity. Use this in non-hook contexts.
 */
export async function checkIsOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected && state.isInternetReachable !== false;
}

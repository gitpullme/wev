// kernel/bridge/WevSDKContext.tsx
// React Context for injecting the WevSDK into mini-apps.
// MiniAppHost creates the scoped SDK and wraps the mini-app's
// component tree with this provider. The mini-app uses useWevSDK()
// to access it.
//
// Calling useWevSDK() outside a provider throws immediately —
// this catches accidental direct imports between mini-app folders.

import React, { createContext, useContext, ReactNode } from 'react';
import { WevSDK } from './types';

const WevSDKContext = createContext<WevSDK | null>(null);

interface WevSDKProviderProps {
  sdk: WevSDK;
  children: ReactNode;
}

/**
 * Provider that injects a scoped WevSDK into the React tree.
 * Used by MiniAppHost — mini-apps should never render this directly.
 */
export function WevSDKProvider({ sdk, children }: WevSDKProviderProps) {
  return (
    <WevSDKContext.Provider value={sdk}>
      {children}
    </WevSDKContext.Provider>
  );
}

/**
 * Hook for mini-apps to access their scoped WevSDK.
 * Throws if called outside a WevSDKProvider — this prevents
 * mini-apps from being used outside the kernel's mount flow.
 */
export function useWevSDK(): WevSDK {
  const sdk = useContext(WevSDKContext);
  if (!sdk) {
    throw new Error(
      'useWevSDK() must be called within a mini-app mounted by the kernel. ' +
      'If you see this error, the component is being rendered outside MiniAppHost.'
    );
  }
  return sdk;
}

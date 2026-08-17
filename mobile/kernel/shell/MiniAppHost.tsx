// kernel/shell/MiniAppHost.tsx
// The mounting component. Takes a mini-app ID, looks it up in
// the registry, creates a scoped WevSDK, and wraps the mini-app
// entry component in:
//   1. ErrorBoundary (fault isolation)
//   2. WevSDKProvider (bridge injection)
//
// The shell NEVER imports mini-app code directly. It calls
// registry.getEntry(id) which returns the lazy-loaded component.

import React, { useEffect, useState, useCallback, ComponentType } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { MiniAppRegistry } from '../registry/MiniAppRegistry';
import { MiniAppManifest, MiniAppProps } from '../registry/types';
import { createWevSDK } from '../bridge/createWevSDK';
import { WevSDKProvider } from '../bridge/WevSDKContext';
import { MiniAppErrorBoundary } from './MiniAppErrorBoundary';
import { useAuthStore } from '../../src/stores/authStore';

interface MiniAppHostProps {
  miniAppId: string;
  /** Optional params forwarded from deep links (e.g., startTime, endTime) */
  params?: Record<string, string>;
}

/**
 * MiniAppHost is the gateway between the kernel and a mini-app.
 * It handles the full lifecycle: discover → load → mount → teardown.
 */
export function MiniAppHost({ miniAppId, params }: MiniAppHostProps) {
  const [MiniAppComponent, setMiniAppComponent] =
    useState<ComponentType<MiniAppProps> | null>(null);
  const [manifest, setManifest] = useState<MiniAppManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user from auth store for the SDK
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    let cancelled = false;

    async function loadMiniApp() {
      // 1. Look up the manifest in the registry
      const m = MiniAppRegistry.get(miniAppId);
      if (!m) {
        setError(`Mini-app "${miniAppId}" is not registered.`);
        setLoading(false);
        return;
      }

      setManifest(m);

      try {
        // 2. Lazy-load the entry component
        const module = await m.entry();

        if (!cancelled) {
          setMiniAppComponent(() => module.default);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            `Failed to load mini-app "${miniAppId}": ${
              err instanceof Error ? err.message : 'Unknown error'
            }`
          );
          setLoading(false);
        }
      }
    }

    loadMiniApp();

    // Teardown: if the user navigates away before loading completes,
    // we cancel to avoid setting state on an unmounted component.
    return () => {
      cancelled = true;
    };
  }, [miniAppId]);

  const handleGoHome = useCallback(() => {
    router.replace('/(app)');
  }, []);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={styles.loadingText}>
          Loading {manifest?.name ?? miniAppId}...
        </Text>
      </View>
    );
  }

  // Error state (registry miss or load failure)
  if (error || !MiniAppComponent || !manifest) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>🔌</Text>
        <Text style={styles.errorTitle}>Mini-app unavailable</Text>
        <Text style={styles.errorMessage}>{error ?? 'Component failed to load'}</Text>
      </View>
    );
  }

  // 3. Create the scoped SDK for this mini-app
  const sdk = createWevSDK(
    manifest.id,
    manifest.requiredPermissions,
    () => user,
  );

  // 4. Mount: ErrorBoundary → WevSDKProvider → MiniApp
  return (
    <MiniAppErrorBoundary
      miniAppId={manifest.id}
      miniAppName={manifest.name}
      onGoHome={handleGoHome}
    >
      <WevSDKProvider sdk={sdk}>
        <MiniAppComponent miniAppId={manifest.id} />
      </WevSDKProvider>
    </MiniAppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FAFAFA',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

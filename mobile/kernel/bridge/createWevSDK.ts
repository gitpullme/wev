// kernel/bridge/createWevSDK.ts
// Factory function that creates a scoped, permission-gated WevSDK
// for a specific mini-app. This is the capability boundary.
//
// Every SDK method checks permissions BEFORE executing. A mini-app
// without 'storage:write' calling wev.storage.set() gets a
// PermissionDeniedError — no side-effect occurs.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Permission } from '../registry/types';
import { WevSDK, WevUser, PermissionDeniedError } from './types';
import { EventBus } from './EventBus';

/**
 * Creates a scoped WevSDK for a specific mini-app.
 *
 * @param miniAppId - The mini-app's unique identifier
 * @param grantedPermissions - Permissions declared in the manifest
 * @param getUser - Getter function for the current user (from auth store)
 */
export function createWevSDK(
  miniAppId: string,
  grantedPermissions: Permission[],
  getUser: () => WevUser | null,
): WevSDK {
  const permissionSet = new Set(grantedPermissions);

  /** Enforce a permission, throwing if not granted. */
  function enforce(permission: Permission): void {
    if (!permissionSet.has(permission)) {
      throw new PermissionDeniedError(miniAppId, permission);
    }
  }

  /**
   * Storage key namespace. All keys are prefixed with the mini-app ID
   * so Sports calling set('draft', x) writes to 'miniapp:sports:draft'.
   * Care cannot read it — the prefix isolation is absolute.
   */
  function namespacedKey(key: string): string {
    return `miniapp:${miniAppId}:${key}`;
  }

  return {
    // ── Auth Bridge ──────────────────────────────────────────────
    auth: {
      getUser(): WevUser | null {
        enforce('auth:read');
        return getUser();
      },
    },

    // ── Storage Bridge (namespaced per mini-app) ─────────────────
    storage: {
      async get(key: string): Promise<string | null> {
        enforce('storage:read');
        return AsyncStorage.getItem(namespacedKey(key));
      },

      async set(key: string, val: string): Promise<void> {
        enforce('storage:write');
        await AsyncStorage.setItem(namespacedKey(key), val);
      },

      async remove(key: string): Promise<void> {
        enforce('storage:write');
        await AsyncStorage.removeItem(namespacedKey(key));
      },
    },

    // ── Navigation Bridge ────────────────────────────────────────
    nav: {
      navigate(target: string, params?: Record<string, string>): void {
        // If target looks like another mini-app ID (no slashes),
        // it's an external navigation requiring nav:external.
        const isExternal = !target.includes('/');

        if (isExternal) {
          enforce('nav:external');
          // Deep-link into another mini-app via the dynamic route
          const queryString = params
            ? '?' + new URLSearchParams(params).toString()
            : '';
          router.push(`/mini-app/${target}${queryString}` as any);
        } else {
          enforce('nav:internal');
          // Internal navigation within the mini-app's own stack.
          // The mini-app controls its own internal routing.
          // This is mainly for programmatic navigation from the SDK.
          const queryString = params
            ? '?' + new URLSearchParams(params).toString()
            : '';
          router.push(`${target}${queryString}` as any);
        }
      },

      goBack(): void {
        enforce('nav:internal');
        router.back();
      },
    },

    // ── Bridge (cross-mini-app event bus) ─────────────────────────
    bridge: {
      emit(event: string, payload: unknown): void {
        enforce('bridge:emit');
        // Namespace the event: 'booking:created' → 'sports:booking:created'
        const namespacedEvent = `${miniAppId}:${event}`;
        EventBus.emit(namespacedEvent, payload);
      },

      on(event: string, handler: (payload: unknown) => void): () => void {
        enforce('bridge:listen');
        // Listeners can subscribe to any namespace (including other mini-apps)
        // This is intentional — it enables cross-app coordination.
        return EventBus.on(event, handler);
      },
    },

    // ── Permission Introspection ─────────────────────────────────
    permissions: {
      async request(scope: Permission): Promise<'granted' | 'denied'> {
        // Declarative — no runtime escalation. If the manifest
        // declared it, it's granted. Otherwise, denied.
        return permissionSet.has(scope) ? 'granted' : 'denied';
      },

      has(scope: Permission): boolean {
        return permissionSet.has(scope);
      },
    },
  };
}

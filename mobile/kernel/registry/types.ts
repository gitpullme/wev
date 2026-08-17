// kernel/registry/types.ts
// Core types for the mini-app manifest and permission system.
// Every mini-app declares a manifest. The kernel reads it to discover,
// mount, and sandbox the mini-app.

import { ComponentType } from 'react';

/**
 * Granular permission scopes. Each mini-app declares the permissions
 * it needs in its manifest. The bridge enforces these at call-time —
 * if a mini-app calls an SDK method without the matching permission,
 * it gets a PermissionDeniedError before any side-effect occurs.
 */
export type Permission =
  | 'auth:read'        // Can read user profile
  | 'storage:read'     // Can read from namespaced storage
  | 'storage:write'    // Can write to namespaced storage
  | 'nav:internal'     // Can navigate within own stack
  | 'nav:external'     // Can navigate to other mini-apps
  | 'bridge:emit'      // Can emit cross-app events
  | 'bridge:listen'    // Can listen for cross-app events
  | 'booking:write'    // Can create bookings
  | 'location:read';   // Can access location data

/**
 * Props injected into every mini-app's root component by MiniAppHost.
 * The mini-app should NOT rely on these directly — it should use
 * useWevSDK() from the bridge context instead.
 */
export interface MiniAppProps {
  miniAppId: string;
}

/**
 * The manifest is the contract between a mini-app and the kernel.
 * It declares identity, version, required permissions, and the
 * lazy entry point.
 *
 * The `entry` function returns a dynamic import promise — this
 * enables code-splitting so the kernel only loads a mini-app's
 * code when it's actually mounted.
 */
export interface MiniAppManifest {
  /** Unique identifier — must match the folder name. */
  id: string;

  /** Human-readable display name. */
  name: string;

  /** Semver version string. */
  version: string;

  /** Short one-line description for the discovery grid. */
  description: string;

  /** Ionicons icon name (from @expo/vector-icons). */
  icon: string;

  /** Color used in the discovery grid card. */
  color: string;

  /** Permissions this mini-app requires to function. */
  requiredPermissions: Permission[];

  /**
   * Lazy entry point. Returns a dynamic import resolving to a
   * module with a default export that is a React component.
   *
   * The kernel calls this when mounting the mini-app, wraps
   * the result in ErrorBoundary + WevSDKProvider, and renders it.
   */
  entry: () => Promise<{ default: ComponentType<MiniAppProps> }>;
}

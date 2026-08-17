// kernel/bridge/types.ts
// The WevSDK interface — the ONLY API surface a mini-app receives.
// No other path to host state, native APIs, or other mini-apps' storage.

import { Permission } from '../registry/types';

/**
 * User profile exposed to mini-apps. Intentionally limited —
 * no tokens, no password hash, no role escalation paths.
 */
export interface WevUser {
  id: string;
  email: string;
  displayName: string;
  role: 'GUEST' | 'HOST' | 'ADMIN';
}

/**
 * The WevSDK is the capability boundary between the kernel and mini-apps.
 * Every method is permission-gated: calling a method without the required
 * permission throws a PermissionDeniedError.
 */
export interface WevSDK {
  /** Authentication bridge — read-only access to user profile. */
  auth: {
    /** Returns the current user profile, or null if not authenticated. */
    getUser(): WevUser | null;
  };

  /** Namespaced key-value storage. Sports cannot read Care's keys. */
  storage: {
    /** Get a value from this mini-app's storage namespace. */
    get(key: string): Promise<string | null>;
    /** Set a value in this mini-app's storage namespace. */
    set(key: string, val: string): Promise<void>;
    /** Remove a value from this mini-app's storage namespace. */
    remove(key: string): Promise<void>;
  };

  /** Navigation — confined to the calling mini-app's own stack by default. */
  nav: {
    /**
     * Navigate to a target. If target is a path within this mini-app,
     * pushes onto the internal stack. If target is another mini-app ID
     * (e.g., 'care'), requires nav:external permission and deep-links.
     *
     * @param target - Internal path or external mini-app ID
     * @param params - Optional query parameters
     */
    navigate(target: string, params?: Record<string, string>): void;
    /** Go back in the navigation stack. */
    goBack(): void;
  };

  /** Cross-mini-app event bus — the ONLY legal channel for coordination. */
  bridge: {
    /**
     * Emit an event. The event is namespaced: emitting 'booking:created'
     * from the sports mini-app actually emits 'sports:booking:created'.
     */
    emit(event: string, payload: unknown): void;
    /**
     * Listen for an event. Can listen to any namespace (including other
     * mini-apps' events). Returns an unsubscribe function.
     *
     * @param event - Full event name (e.g., 'sports:booking:created')
     * @param handler - Callback receiving the event payload
     * @returns Unsubscribe function — call it in cleanup/unmount
     */
    on(event: string, handler: (payload: unknown) => void): () => void;
  };

  /** Permission introspection and runtime checks. */
  permissions: {
    /**
     * Request a permission scope. Returns 'granted' if the permission
     * was declared in the mini-app's manifest, 'denied' otherwise.
     * No runtime escalation — this is declarative, not interactive.
     */
    request(scope: Permission): Promise<'granted' | 'denied'>;
    /** Check if a permission is currently granted. */
    has(scope: Permission): boolean;
  };
}

/**
 * Error thrown when a mini-app calls an SDK method without
 * the required permission. The bridge catches this and
 * prevents any side-effect.
 */
export class PermissionDeniedError extends Error {
  constructor(
    public readonly miniAppId: string,
    public readonly requiredPermission: Permission,
  ) {
    super(
      `PermissionDenied: Mini-app "${miniAppId}" lacks permission "${requiredPermission}". ` +
      `Declare it in your manifest's requiredPermissions array.`
    );
    this.name = 'PermissionDeniedError';
  }
}

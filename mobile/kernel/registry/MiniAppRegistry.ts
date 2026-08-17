// kernel/registry/MiniAppRegistry.ts
// Singleton registry for discovering installed mini-apps at runtime.
// The host shell reads this to render the discovery grid and mount
// mini-apps. Adding a new mini-app = registering one more manifest.

import { MiniAppManifest } from './types';

class MiniAppRegistryImpl {
  private manifests = new Map<string, MiniAppManifest>();

  /**
   * Register a mini-app manifest. Called once per mini-app at boot.
   * Throws if a duplicate ID is registered — this catches
   * configuration errors early.
   */
  register(manifest: MiniAppManifest): void {
    if (this.manifests.has(manifest.id)) {
      throw new Error(
        `MiniAppRegistry: Duplicate mini-app ID "${manifest.id}". ` +
        `Each mini-app must have a unique identifier.`
      );
    }
    this.manifests.set(manifest.id, manifest);
  }

  /**
   * Get all registered manifests. Used by the home screen
   * to render the mini-app discovery grid.
   */
  getAll(): MiniAppManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * Get a single manifest by ID. Returns undefined if not found.
   */
  get(id: string): MiniAppManifest | undefined {
    return this.manifests.get(id);
  }

  /**
   * Get the lazy entry component for a mini-app. This is the
   * function the shell calls to load the mini-app's code on demand.
   */
  getEntry(id: string): MiniAppManifest['entry'] | undefined {
    return this.manifests.get(id)?.entry;
  }

  /**
   * Check if a mini-app is registered.
   */
  has(id: string): boolean {
    return this.manifests.has(id);
  }

  /**
   * Number of registered mini-apps.
   */
  get size(): number {
    return this.manifests.size;
  }
}

// Singleton — one registry for the entire app lifecycle.
export const MiniAppRegistry = new MiniAppRegistryImpl();

// kernel/registry/index.ts
// ┌────────────────────────────────────────────────────────────┐
// │  THIS IS THE ONLY FILE THAT CHANGES WHEN ADDING A NEW     │
// │  MINI-APP. Add one import + one register() call.          │
// │                                                            │
// │  Zero changes to Sports, Events, or Care code.            │
// │  Zero changes to the host shell.                          │
// └────────────────────────────────────────────────────────────┘

import { MiniAppRegistry } from './MiniAppRegistry';

// Import each mini-app's manifest.
// The manifest is a static declaration — no side effects, no UI code.
// The actual mini-app code is lazy-loaded via manifest.entry().
import { sportsManifest } from '../../mini-apps/sports/manifest';
import { eventsManifest } from '../../mini-apps/events/manifest';
import { careManifest } from '../../mini-apps/care/manifest';

// Register all mini-apps.
// Order doesn't matter — the home screen can sort however it wants.
MiniAppRegistry.register(sportsManifest);
MiniAppRegistry.register(eventsManifest);
MiniAppRegistry.register(careManifest);

// To add a 4th mini-app (e.g., "marketplace"):
// 1. Create mini-apps/marketplace/manifest.ts
// 2. Create mini-apps/marketplace/Entry.tsx
// 3. Add these two lines here:
//    import { marketplaceManifest } from '../../mini-apps/marketplace/manifest';
//    MiniAppRegistry.register(marketplaceManifest);
// That's it. No other files need to change.

export { MiniAppRegistry };

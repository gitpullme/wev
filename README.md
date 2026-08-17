# WEVSOCIAL Super-App

A mini-app kernel that discovers, mounts, sandboxes, and bridges independent mini-apps (Sports, Events, Care) within a React Native shell.

## Architecture

```
Host Shell (kernel/)
├── registry/       — Discovers & stores mini-app manifests
├── bridge/         — WevSDK: the ONLY API surface for mini-apps
│   ├── createWevSDK.ts   — Permission-gated SDK factory
│   ├── EventBus.ts       — Cross-mini-app event emitter
│   └── WevSDKContext.tsx — React Context injection
└── shell/          — MiniAppHost (mount) + ErrorBoundary (isolate)

Mini-Apps (mini-apps/)
├── sports/   — Full: activities, booking, bridge emit
├── events/   — Stub: proves registry generalizes
└── care/     — Full: providers, geo-privacy, bridge listen

Backend (backend/)
├── src/routes/     — auth, sports, care, events
├── src/services/   — authService (argon2 + JWT), geoObfuscation
├── src/middleware/ — requireAuth, requireRole
└── src/db/         — Drizzle schema + migrations + seed
```

## Quick Start

### 1. Start the backend infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL 16 + PostGIS and the Express backend.
Migrations run automatically on startup. No manual steps.

### 2. Start the mobile app

```bash
cd mobile
npm start
```

Scan the QR with Expo Go, or press `a` for Android emulator.

> **Environment**: The mobile app auto-resolves the API URL from `Constants.expoConfig.hostUri`. For physical devices, set `EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3001` in `mobile/.env`.

### 3. Seed test users (optional)

```bash
cd backend
npm run db:seed
```

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | admin@wevsocial.com | password123 | ADMIN |
| Host | host@wevsocial.com | password123 | HOST |
| Guest | guest@wevsocial.com | password123 | GUEST |

---

## Part 1: The Kernel

### Mini-App Manifest

```typescript
// mini-apps/sports/manifest.ts
export const sportsManifest: MiniAppManifest = {
  id: 'sports',
  name: 'Sports',
  version: '1.0.0',
  requiredPermissions: ['auth:read', 'bridge:emit', 'booking:write', ...],
  entry: () => import('./Entry'),   // lazy-loaded
};
```

### Adding a 4th Mini-App

Change **one file** (`kernel/registry/index.ts`):
```typescript
import { marketplaceManifest } from '../../mini-apps/marketplace/manifest';
MiniAppRegistry.register(marketplaceManifest);
```

Zero changes to Sports, Events, Care, or the host shell.

### Fault Isolation

Each mini-app is wrapped in its own `ErrorBoundary`. To demo:
1. Open Sports mini-app
2. Tap **🐛 Crash Test**
3. Sports shows error fallback
4. Navigate back → Care and Events work normally

### Cross-Mini-App Coordination (1.5)

```
Sports booking confirmed
  → wev.bridge.emit('booking:created', { startTime, endTime, activityName })
  → SDK namespaces to: 'sports:booking:created'
  → EventBus delivers to all listeners

Care listens:
  → wev.bridge.on('sports:booking:created', handler)
  → Shows banner: "Need childcare during [activityName]?"
  → Tap → navigates to Care booking pre-filled with time
```

No direct imports between mini-app folders — bridge mediates everything.

---

## Part 2: Auth & RBAC

### Token Flow

- **Access token**: 15-min JWT (HS256), stored in `expo-secure-store`
- **Refresh token**: 7-day JWT, family-tracked in DB for reuse detection
- **Rotation**: each `/api/auth/refresh` invalidates old token, issues new pair
- **Reuse detection**: presenting a revoked token revokes entire token family

### API-Level Enforcement

```bash
# Guest hitting a HOST-only endpoint
curl -X POST http://localhost:3001/api/sports/activities \
  -H "Authorization: Bearer <guest-token>"
# → 403 {"error":"FORBIDDEN","message":"Insufficient permissions"}

# No token at all
curl http://localhost:3001/api/care/providers
# → 401 {"error":"UNAUTHORIZED","message":"Missing or invalid token"}
```

### Bridge-Level Enforcement

```typescript
// mini-apps/events/Entry.tsx — only has ['auth:read', 'nav:internal']
const wev = useWevSDK();
wev.bridge.emit('test', {}); // PermissionDeniedError: lacks 'bridge:emit'
wev.storage.set('key', 'v'); // PermissionDeniedError: lacks 'storage:write'
```

Permission check happens **inside the bridge, before any network request**.

---

## Part 3: Care Geo-Privacy

### Rules

| Status | Lat/Lng returned | Address returned |
|--------|-----------------|-----------------|
| PENDING / CANCELLED | Obfuscated (~500m offset) | ❌ Never |
| CONFIRMED | Exact | ✅ Yes |

### Obfuscation

```typescript
// Deterministic — same seed → same offset → stable across renders/restarts
obfuscateLocation(exactLat, exactLng, provider.obfuscationSeed)
// → { lat: exactLat + deltaLat, lng: exactLng + deltaLng }
```

Sorted by **obfuscated distance** (not exact) — prevents triangulation attacks.

**Enforcement is at the API layer** — the client never receives exact coordinates for non-confirmed bookings regardless of what it requests.

---

## Part 4: Offline-First Booking

### State Machine

```
IDLE → QUEUED → SYNCING → SUCCESS
                        → CONFLICT_REJECTED
CONFLICT_REJECTED → IDLE (retry)
```

### Flow

| State | UI Label | What happened |
|-------|----------|---------------|
| QUEUED | "Pending Sync ⏳" | Device offline, queued to AsyncStorage |
| SYNCING | "Syncing..." | Back online, sending to server |
| SUCCESS | "Confirmed ✓" | Server accepted |
| CONFLICT_REJECTED | "Slot Unavailable ✗" | 409 from server, UI rolled back |

### Simulating Offline

1. Enable Airplane Mode on device
2. Book a Sports session → UI shows "Pending Sync ⏳"
3. Disable Airplane Mode → auto-sync fires → "Confirmed ✓"

### Simulating 409 Conflict

Set `capacity: 1` on an activity via seed, have two users book simultaneously. Second user's UI transitions to `CONFLICT_REJECTED`.

---

## Project Structure

```
wevsocial/
├── docker-compose.yml         ← docker compose up (zero manual steps)
├── backend/
│   ├── Dockerfile
│   ├── drizzle/               ← committed SQL migrations (re-runnable)
│   └── src/
│       ├── db/schema.ts       ← single source of truth
│       ├── routes/            ← auth, sports, care (geo-privacy), events
│       ├── services/          ← authService (argon2id + JWT), geoObfuscation
│       └── middleware/        ← requireAuth, requireRole
└── mobile/
    ├── kernel/                ← THE KERNEL (shell, registry, bridge)
    ├── mini-apps/             ← isolated mini-apps
    │   ├── sports/
    │   ├── events/            ← stub
    │   └── care/
    ├── src/
    │   ├── stores/authStore   ← Zustand (tokens in SecureStore)
    │   ├── services/api       ← Axios + silent refresh
    │   └── booking/           ← shared state machine + offline queue
    └── app/                   ← Expo Router file-based routes
        ├── (auth)/login, register
        └── (app)/index, mini-app/[id]
```

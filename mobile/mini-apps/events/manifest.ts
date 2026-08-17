import { MiniAppManifest } from '../../kernel/registry/types';

export const eventsManifest: MiniAppManifest = {
  id: 'events',
  name: 'Events',
  version: '1.0.0',
  description: 'Discover and book local events',
  icon: 'calendar-outline',
  color: '#4ECDC4',
  requiredPermissions: ['auth:read', 'nav:internal'],
  entry: () => import('./Entry'),
};

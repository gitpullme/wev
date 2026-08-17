import { MiniAppManifest } from '../../kernel/registry/types';

export const sportsManifest: MiniAppManifest = {
  id: 'sports',
  name: 'Sports',
  version: '1.0.0',
  description: 'Create, discover and book sporting activities',
  icon: 'basketball-outline',
  color: '#FF6B35',
  requiredPermissions: ['auth:read', 'storage:read', 'storage:write', 'nav:internal', 'bridge:emit', 'booking:write'],
  entry: () => import('./Entry'),
};

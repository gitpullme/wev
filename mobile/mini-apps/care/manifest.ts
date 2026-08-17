import { MiniAppManifest } from '../../kernel/registry/types';

export const careManifest: MiniAppManifest = {
  id: 'care',
  name: 'Care',
  version: '1.0.0',
  description: 'Book vetted care providers for in-home services',
  icon: 'heart-outline',
  color: '#E63946',
  requiredPermissions: ['auth:read', 'storage:read', 'storage:write', 'nav:internal', 'nav:external', 'bridge:listen', 'booking:write', 'location:read'],
  entry: () => import('./Entry'),
};

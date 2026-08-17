import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
// Import from registry/index which registers all mini-apps once at boot.
// Never call MiniAppRegistry.register() here — that causes duplicate-ID errors on re-renders.
import { MiniAppRegistry } from '../../kernel/registry/index';

export default function HomeScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const miniApps = MiniAppRegistry.getAll();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.brandTitle}>WEVSOCIAL</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.userRow}>
        <Text style={styles.welcomeText}>Hello, {user?.displayName || 'User'}!</Text>
        {user?.role && (
          <View style={[styles.roleBadge, { backgroundColor: user.role === 'GUEST' ? '#4A90D9' : user.role === 'HOST' ? '#7B5EA7' : user.role === 'ADMIN' ? '#E63946' : '#999' }]}>
            <Text style={styles.roleText}>{user.role}</Text>
          </View>
        )}
      </View>
      <Text style={styles.subtitle}>Discover Mini-Apps</Text>
      <Text style={styles.subtitle}>Discover Mini-Apps</Text>

      <Text style={styles.demoText}>Demo: guest@example.com / host1@example.com / admin@example.com — password: password123</Text>

      <FlatList
        data={miniApps}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.card, { borderTopColor: item.color, borderTopWidth: 4 }]} 
            onPress={() => router.push(`/mini-app/${item.id}`)}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
              {/* Using text emoji for icon placeholder, but expo/vector-icons would be better if we knew the specific package */}
              <Text style={{ fontSize: 24 }}>{item.icon === 'basketball-outline' ? '🏀' : item.icon === 'calendar-outline' ? '📅' : '❤️'}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
            <View style={styles.permBadge}>
              <Text style={styles.permBadgeText}>{item.manifest?.permissions?.length || 0} permissions</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  brandTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 1, color: '#111' },
  logoutButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#e0e0e0', borderRadius: 16 },
  logoutText: { fontSize: 14, fontWeight: '600', color: '#333' },
  welcomeText: { fontSize: 22, fontWeight: '700', color: '#222' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  roleBadge: { marginLeft: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#666', paddingHorizontal: 20, marginBottom: 8, marginTop: 4 },
  demoText: { fontSize: 12, color: '#888', paddingHorizontal: 20, marginBottom: 16, fontStyle: 'italic' },
  gridContainer: { paddingHorizontal: 12, paddingBottom: 20 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  iconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  cardDescription: { fontSize: 13, color: '#777', lineHeight: 18, marginBottom: 12 },
  permBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: '#f0f0f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  permBadgeText: { fontSize: 10, color: '#666' }
});

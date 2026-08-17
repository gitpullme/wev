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

      <Text style={styles.welcomeText}>Hello, {user?.displayName || 'User'}!</Text>
      <Text style={styles.subtitle}>Discover Mini-Apps</Text>

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
  welcomeText: { fontSize: 22, fontWeight: '700', paddingHorizontal: 20, color: '#222' },
  subtitle: { fontSize: 16, color: '#666', paddingHorizontal: 20, marginBottom: 16, marginTop: 4 },
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
  },
  iconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  cardDescription: { fontSize: 13, color: '#777', lineHeight: 18 },
});

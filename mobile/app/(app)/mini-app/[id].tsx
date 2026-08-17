import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MiniAppHost } from '../../../kernel/shell/MiniAppHost';
import { MiniAppRegistry } from '../../../kernel/registry/index';
import { useNetworkStatus } from '../../../src/utils/networkStatus';
import { useNetworkOverrideStore } from '../../../src/stores/networkOverrideStore';
import { queueSize } from '../../../src/booking/offlineQueue';

export default function MiniAppScreen() {
  const router = useRouter();
  const { id, ...params } = useLocalSearchParams<{ id: string }>() as { id: string; [key: string]: string };

  // Real + simulated connectivity state
  const { isOnline } = useNetworkStatus();
  const simulatedOffline = useNetworkOverrideStore((s) => s.simulatedOffline);
  const toggleSimulatedOffline = useNetworkOverrideStore((s) => s.toggleSimulatedOffline);

  const [queueCount, setQueueCount] = useState(0);
  const [showPermissions, setShowPermissions] = useState(false);

  const manifest = MiniAppRegistry.get(id);
  const permissions = manifest?.requiredPermissions ?? [];

  // Refresh queue count whenever the screen mounts or connectivity changes
  useEffect(() => {
    queueSize().then(setQueueCount);
  }, [isOnline]);

  // Pill label + color
  const pillBg = isOnline ? '#2E7D32' : '#E65100';
  const pillLabel = isOnline
    ? '🟢 Online'
    : `🟠 Offline${queueCount > 0 ? ` (${queueCount} queued)` : ''}`;

  const toggleBg = simulatedOffline ? '#B71C1C' : '#1565C0';
  const toggleLabel = simulatedOffline ? '📡 Go Online' : '✈️ Go Offline';

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Shell Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Close</Text>
        </TouchableOpacity>

        <Text style={styles.appName}>{manifest?.name || id}</Text>

        <View style={styles.rightControls}>
          {/* Connectivity Status Pill (read-only indicator) */}
          <View style={[styles.pill, { backgroundColor: pillBg }]}>
            <Text style={styles.pillText}>{pillLabel}</Text>
          </View>

          {/* 🛡️ Capabilities Chip */}
          <TouchableOpacity
            style={[styles.pill, { backgroundColor: '#00695C', marginLeft: 6 }]}
            onPress={() => setShowPermissions(true)}
          >
            <Text style={styles.pillText}>🛡️ {permissions.length}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Offline Simulator Banner ─────────────────────────────── */}
      <View style={[styles.offlineBanner, { backgroundColor: simulatedOffline ? '#FBE9E7' : '#E8F5E9' }]}>
        <View style={styles.offlineBannerLeft}>
          <Text style={[styles.offlineBannerTitle, { color: simulatedOffline ? '#BF360C' : '#1B5E20' }]}>
            {simulatedOffline
              ? '✈️ Simulated Offline Mode Active'
              : '🌐 Simulated Network: Online'}
          </Text>
          <Text style={[styles.offlineBannerSub, { color: simulatedOffline ? '#E64A19' : '#388E3C' }]}>
            {simulatedOffline
              ? 'Bookings will be queued locally. Tap to reconnect & sync.'
              : 'Tap to simulate going offline and test the offline queue.'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: toggleBg }]}
          onPress={toggleSimulatedOffline}
          activeOpacity={0.8}
        >
          <Text style={styles.toggleBtnText}>{toggleLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Permissions Modal ────────────────────────────────────── */}
      <Modal visible={showPermissions} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🛡️ Granted Capabilities</Text>
            <Text style={styles.modalSubtitle}>
              WevSDK scopes declared in this mini-app's manifest. Any SDK call outside this set throws PermissionDeniedError before any network call.
            </Text>
            {permissions.map((p: string, i: number) => (
              <Text key={i} style={styles.permText}>• {p}</Text>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowPermissions(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Mini-App Content ─────────────────────────────────────── */}
      <View style={styles.content}>
        <MiniAppHost miniAppId={id} params={params} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header
  header: {
    height: 52,
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backButton: { paddingVertical: 8, paddingRight: 8 },
  backText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  appName: { fontSize: 15, color: '#fff', fontWeight: 'bold', flex: 1, textAlign: 'center' },
  rightControls: { flexDirection: 'row', alignItems: 'center' },
  pill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, justifyContent: 'center' },
  pillText: { fontSize: 9, color: '#fff', fontWeight: 'bold' },

  // Offline Simulator Banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  offlineBannerLeft: { flex: 1, marginRight: 10 },
  offlineBannerTitle: { fontSize: 12, fontWeight: '700' },
  offlineBannerSub: { fontSize: 11, marginTop: 2 },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  toggleBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  content: { flex: 1 },

  // Permissions modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '82%' },
  modalTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 6 },
  modalSubtitle: { fontSize: 12, color: '#666', marginBottom: 12, lineHeight: 17 },
  permText: { fontSize: 13, marginBottom: 7, color: '#333' },
  modalCloseBtn: { marginTop: 14, alignSelf: 'flex-end', backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  modalCloseText: { color: '#fff', fontWeight: 'bold' },
});

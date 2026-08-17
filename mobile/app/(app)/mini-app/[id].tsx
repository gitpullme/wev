import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MiniAppHost } from '../../../kernel/shell/MiniAppHost';
import { MiniAppRegistry } from '../../../kernel/registry/index';
import { useNetworkStatus } from '../../../src/utils/networkStatus';
import { queueSize } from '../../../src/booking/offlineQueue';

export default function MiniAppScreen() {
  const router = useRouter();
  const { id, ...params } = useLocalSearchParams<{ id: string }>() as { id: string; [key: string]: string };
  const { isOnline } = useNetworkStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [showPermissions, setShowPermissions] = useState(false);

  const manifest = MiniAppRegistry.get(id);
  const permissions = manifest?.requiredPermissions ?? [];

  // Load total queue count from AsyncStorage at the shell level
  useEffect(() => {
    queueSize().then(setQueueCount);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Close App</Text>
        </TouchableOpacity>
        <Text style={styles.appName}>{manifest?.name || id}</Text>
        <View style={styles.rightControls}>
          <View style={[styles.pill, { backgroundColor: isOnline ? '#4CAF50' : '#FF9800' }]}>
            <Text style={styles.pillText}>
              {isOnline ? '🟢 Online' : `🟠 Offline (${queueCount} queued)`}
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.pill, { backgroundColor: '#009688', marginLeft: 8 }]}
            onPress={() => setShowPermissions(true)}
          >
            <Text style={styles.pillText}>🛡️ {permissions.length} perms</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <Modal visible={showPermissions} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🛡️ Granted Capabilities</Text>
            <Text style={styles.modalSubtitle}>These are the WevSDK scopes declared in this mini-app's manifest. Any SDK call outside this set throws PermissionDeniedError.</Text>
            {permissions.map((p: string, i: number) => (
              <Text key={i} style={styles.permText}>• {p}</Text>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowPermissions(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.content}>
        <MiniAppHost miniAppId={id} params={params} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    height: 60, 
    backgroundColor: '#111', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16 
  },
  backButton: { paddingVertical: 8 },
  backText: { fontSize: 14, color: '#fff', fontWeight: '500' },
  appName: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
  rightControls: { flexDirection: 'row', alignItems: 'center' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, justifyContent: 'center' },
  pillText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  content: { flex: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  modalSubtitle: { fontSize: 12, color: '#666', marginBottom: 12, lineHeight: 18 },
  permText: { fontSize: 14, marginBottom: 8, color: '#333' },
  modalCloseBtn: { marginTop: 16, alignSelf: 'flex-end', backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  modalCloseText: { color: '#fff', fontWeight: 'bold' }
});

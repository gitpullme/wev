import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MiniAppHost } from '../../../kernel/shell/MiniAppHost';

export default function MiniAppScreen() {
  const router = useRouter();
  const { id, ...params } = useLocalSearchParams<{ id: string }>() as { id: string; [key: string]: string };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Close App</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <MiniAppHost miniAppId={id} params={params} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    height: 50, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    justifyContent: 'center', 
    paddingHorizontal: 16 
  },
  backButton: { paddingVertical: 8 },
  backText: { fontSize: 16, color: '#007AFF', fontWeight: '500' },
  content: { flex: 1 },
});

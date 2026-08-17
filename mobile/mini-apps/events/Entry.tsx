import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/services/api';

type EventData = {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
};

export default function EventsEntry() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const response = await api.get('/api/events');
      return response.data.data as EventData[];
    },
  });

  if (isLoading) return <ActivityIndicator style={styles.centered} size="large" color="#4ECDC4" />;
  if (error) return <Text style={styles.errorText}>Failed to load events</Text>;

  return (
    <View style={styles.container}>
      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>🧩 Registry Generalizability Demonstration</Text>
        <Text style={styles.calloutText}>
          Events is an intentionally minimal stub proving that adding a 3rd mini-app required zero changes to Sports, Care, or the host shell kernel.
        </Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
            <Text style={styles.cardDetail}>🕒 {new Date(item.startTime).toLocaleDateString()} {new Date(item.startTime).toLocaleTimeString()}</Text>
            <Text style={styles.cardDetail}>📍 {item.location}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red', textAlign: 'center', marginTop: 20 },
  callout: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1565C0', marginBottom: 16 },
  calloutTitle: { color: '#1565C0', fontWeight: 'bold', marginBottom: 4 },
  calloutText: { color: '#1565C0', fontSize: 13 },
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderLeftWidth: 4, borderLeftColor: '#4ECDC4'
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardDescription: { fontSize: 14, color: '#666', marginBottom: 8 },
  cardDetail: { fontSize: 13, color: '#555', marginTop: 2 },
});

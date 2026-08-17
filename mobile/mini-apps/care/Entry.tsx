import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useWevSDK } from '../../kernel/bridge/WevSDKContext';
import { api } from '../../src/services/api';
import { useOfflineAwareBooking } from '../../src/booking/useOfflineAwareBooking';
import { statusLabel } from '../../src/booking/bookingStateMachine';

// Types
type Provider = {
  id: string;
  name: string;
  serviceType: string;
  hourlyRate: number;
  distance: number;
  bio: string;
};

type CrossAppSuggestion = {
  activityName: string;
  startTime: string;
  endTime: string;
};

// --- Screens ---
function ProviderListScreen({ 
  onSelect, 
  suggestion, 
  onSuggestionTap 
}: { 
  onSelect: (provider: Provider) => void;
  suggestion: CrossAppSuggestion | null;
  onSuggestionTap: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['care-providers'],
    queryFn: async () => {
      const response = await api.get('/api/care/providers?userLat=40.75&userLng=-73.98');
      return response.data.data as Provider[];
    },
  });

  if (isLoading) return <ActivityIndicator style={styles.centered} size="large" color="#E63946" />;
  if (error) return <Text style={styles.errorText}>Failed to load providers</Text>;

  return (
    <View style={styles.container}>
      {suggestion && (
        <View style={styles.suggestionBanner}>
          <Text style={styles.suggestionText}>
            Need childcare during your {suggestion.activityName}?
          </Text>
          <TouchableOpacity style={styles.suggestionButton} onPress={onSuggestionTap}>
            <Text style={styles.suggestionButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelect(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.verifiedBadge}>✓ Verified</Text>
            </View>
            <Text style={styles.serviceType}>{item.serviceType}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardDetail}>💰 ${(item.hourlyRate / 100).toFixed(0)}/hr</Text>
              <Text style={styles.cardDetail}>📍 ~{((item.distance ?? 0) / 1000).toFixed(1)} km away</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function ProviderDetailScreen({ provider, onBack, onBook }: { provider: Provider; onBack: () => void; onBook: (provider: Provider) => void }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      
      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>{provider.name}</Text>
        <Text style={styles.serviceType}>{provider.serviceType}</Text>
        <Text style={styles.detailBio}>{provider.bio}</Text>
        
        <View style={styles.statsRow}>
          <Text style={styles.detailInfo}>💰 ${(provider.hourlyRate / 100).toFixed(0)}/hr</Text>
              <Text style={styles.detailInfo}>📍 Approximate location</Text>
        </View>
        
        <TouchableOpacity style={styles.bookButton} onPress={() => onBook(provider)}>
          <Text style={styles.bookButtonText}>Book Provider</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CareBookingScreen({ provider, suggestion, onBack }: { provider: Provider | null; suggestion: CrossAppSuggestion | null; onBack: () => void }) {
  const { status, label, book, reset, isOnline, queueCount } = useOfflineAwareBooking({
    miniAppType: 'care',
    queryKey: ['care-bookings'],
  });

  const handleBook = async () => {
    try {
      await book({
        providerId: provider?.id,
        startTime: suggestion?.startTime || new Date().toISOString(),
        endTime: suggestion?.endTime || new Date(Date.now() + 3600000).toISOString(),
        clientId: `care-${provider?.id}-${Date.now()}`,
      });
    } catch (e) {
      console.error('Booking failed', e);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>Care Booking</Text>
        {provider && <Text style={styles.detailInfo}>Provider: {provider.name}</Text>}
        {suggestion && (
          <View style={styles.timeFrameBox}>
            <Text style={styles.timeFrameTitle}>Scheduled for your activity:</Text>
            <Text style={styles.detailInfo}>
              From: {new Date(suggestion.startTime).toLocaleString()}
            </Text>
            <Text style={styles.detailInfo}>
              To: {new Date(suggestion.endTime).toLocaleString()}
            </Text>
          </View>
        )}

        <Text style={styles.statusLabel}>Status: {label}</Text>
        <Text style={styles.detailInfo}>Network: {isOnline ? 'Online' : 'Offline'}</Text>

        {status === 'IDLE' && (
          <TouchableOpacity style={styles.bookButton} onPress={handleBook}>
            <Text style={styles.bookButtonText}>Confirm Booking</Text>
          </TouchableOpacity>
        )}

        {status === 'SUCCESS' && (
          <View>
            <Text style={styles.successText}>Care provider booked!</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => { reset(); onBack(); }}>
              <Text style={styles.secondaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {status === 'CONFLICT_REJECTED' && (
          <TouchableOpacity style={styles.secondaryButton} onPress={reset}>
            <Text style={styles.secondaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// --- Root Entry ---
export default function CareEntry() {
  const wev = useWevSDK();
  const [currentScreen, setCurrentScreen] = useState<'list' | 'detail' | 'booking'>('list');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [crossAppSuggestion, setCrossAppSuggestion] = useState<CrossAppSuggestion | null>(null);

  useEffect(() => {
    const unsub = wev.bridge.on('sports:booking:created', (payload: any) => {
      setCrossAppSuggestion(payload as CrossAppSuggestion);
    });
    return unsub;
  }, [wev.bridge]);

  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setCurrentScreen('detail');
  };

  const handleBookProvider = (provider: Provider) => {
    setCurrentScreen('booking');
  };

  const handleSuggestionTap = () => {
    // If a suggestion is tapped, go straight to booking without a specific provider selected
    // (Or let them choose a provider and then auto-fill the dates)
    setSelectedProvider(null);
    setCurrentScreen('booking');
  };

  const handleBack = () => {
    if (currentScreen === 'booking') setCurrentScreen(selectedProvider ? 'detail' : 'list');
    else setCurrentScreen('list');
  };

  return (
    <View style={styles.root}>
      {currentScreen === 'list' && (
        <ProviderListScreen 
          onSelect={handleSelectProvider} 
          suggestion={crossAppSuggestion}
          onSuggestionTap={handleSuggestionTap}
        />
      )}
      {currentScreen === 'detail' && selectedProvider && (
        <ProviderDetailScreen provider={selectedProvider} onBack={handleBack} onBook={handleBookProvider} />
      )}
      {currentScreen === 'booking' && (
        <CareBookingScreen provider={selectedProvider} suggestion={crossAppSuggestion} onBack={handleBack} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9f9f9' },
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red', textAlign: 'center', marginTop: 20 },
  suggestionBanner: {
    backgroundColor: '#FFF0F2', padding: 16, borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FFCCD2', flexDirection: 'column', alignItems: 'center'
  },
  suggestionText: { color: '#E63946', fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  suggestionButton: { backgroundColor: '#E63946', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  suggestionButtonText: { color: '#fff', fontWeight: 'bold' },
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  verifiedBadge: { fontSize: 12, color: '#4CAF50', fontWeight: 'bold', backgroundColor: '#E8F5E9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  serviceType: { fontSize: 14, color: '#E63946', fontWeight: '600', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardDetail: { fontSize: 14, color: '#666' },
  backButton: { marginBottom: 16, paddingVertical: 8 },
  backButtonText: { color: '#E63946', fontSize: 16, fontWeight: '600' },
  detailCard: {
    backgroundColor: '#fff', padding: 20, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  detailTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  detailBio: { fontSize: 16, color: '#444', lineHeight: 24, marginBottom: 20, marginTop: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, marginBottom: 20 },
  detailInfo: { fontSize: 15, color: '#555', marginBottom: 8 },
  timeFrameBox: { backgroundColor: '#F8F9FA', padding: 16, borderRadius: 8, marginVertical: 12 },
  timeFrameTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  bookButton: { backgroundColor: '#E63946', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  bookButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statusLabel: { fontSize: 18, fontWeight: '600', color: '#333', marginVertical: 12 },
  successText: { fontSize: 18, color: 'green', fontWeight: 'bold', textAlign: 'center', marginVertical: 16 },
  secondaryButton: { backgroundColor: '#f0f0f0', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
});

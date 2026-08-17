import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useWevSDK } from '../../kernel/bridge/WevSDKContext';
import { api } from '../../src/services/api';
import { useOfflineAwareBooking } from '../../src/booking/useOfflineAwareBooking';
import { statusLabel } from '../../src/booking/bookingStateMachine';

// Types
type Activity = {
  id: string;
  title: string;
  sportType: string;
  location: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  description: string;
};

// --- Crash Test Component ---
class BuggyComponent extends React.Component {
  render() {
    throw new Error('Deliberate crash for fault isolation test');
    return null;
  }
}

// --- Screens ---
function ActivityListScreen({ onSelect, onCrash }: { onSelect: (activity: Activity) => void; onCrash: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sports-activities'],
    queryFn: async () => {
      const response = await api.get('/api/sports/activities');
      return response.data.data as Activity[];
    },
  });

  if (isLoading) return <ActivityIndicator style={styles.centered} size="large" color="#FF6B35" />;
  if (error) return <Text style={styles.errorText}>Failed to load activities</Text>;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.crashButton} onPress={onCrash}>
        <Text style={styles.crashButtonText}>🐛 Crash Test</Text>
      </TouchableOpacity>
      
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelect(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.sportType}>{item.sportType}</Text>
            </View>
            <Text style={styles.cardDetail}>📍 {item.location}</Text>
            <Text style={styles.cardDetail}>
              🕒 {new Date(item.startTime).toLocaleTimeString()} - {new Date(item.endTime).toLocaleTimeString()}
            </Text>
            <Text style={styles.cardDetail}>
              👥 {item.bookedCount} / {item.capacity} spots
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function ActivityDetailScreen({ activity, onBack, onBook }: { activity: Activity; onBack: () => void; onBook: (activity: Activity) => void }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      
      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>{activity.title}</Text>
        <Text style={styles.detailType}>{activity.sportType}</Text>
        <Text style={styles.detailDescription}>{activity.description}</Text>
        <Text style={styles.detailInfo}>📍 Location: {activity.location}</Text>
        <Text style={styles.detailInfo}>
          🕒 Time: {new Date(activity.startTime).toLocaleDateString()} {new Date(activity.startTime).toLocaleTimeString()} - {new Date(activity.endTime).toLocaleTimeString()}
        </Text>
        <Text style={styles.detailInfo}>
          👥 Capacity: {activity.bookedCount} / {activity.capacity} booked
        </Text>
        
        <TouchableOpacity style={styles.bookButton} onPress={() => onBook(activity)}>
          <Text style={styles.bookButtonText}>Book This Session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BookingConfirmationScreen({ activity, onBack }: { activity: Activity; onBack: () => void }) {
  const wev = useWevSDK();
  const { status, label, book, reset, isOnline, queueCount } = useOfflineAwareBooking({
    miniAppType: 'sports',
    queryKey: ['sports-bookings'],
  });

  const handleBook = async () => {
    try {
      await book({
        activityId: activity.id,
        clientId: `sports-${activity.id}-${Date.now()}`,
      });
      
      // Emit cross-app event through the bridge.
      // SDK auto-prefixes with 'sports:', so this emits 'sports:booking:created'
      wev.bridge.emit('booking:created', {
        activityName: activity.title,
        startTime: activity.startTime,
        endTime: activity.endTime,
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
        <Text style={styles.detailTitle}>Booking Status</Text>
        <Text style={styles.statusLabel}>Status: {label}</Text>
        <Text style={styles.detailInfo}>Network: {isOnline ? 'Online' : 'Offline'}</Text>
        {!isOnline && <Text style={styles.detailInfo}>Queued items: {queueCount}</Text>}

        {status === 'IDLE' && (
          <TouchableOpacity style={styles.bookButton} onPress={handleBook}>
            <Text style={styles.bookButtonText}>Confirm Booking</Text>
          </TouchableOpacity>
        )}

        {status === 'SUCCESS' && (
          <View>
            <Text style={styles.successText}>Booking Confirmed!</Text>
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
export default function SportsEntry() {
  const [currentScreen, setCurrentScreen] = useState<'list' | 'detail' | 'booking'>('list');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [crashApp, setCrashApp] = useState(false);

  if (crashApp) {
    return <BuggyComponent />;
  }

  const handleSelectActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setCurrentScreen('detail');
  };

  const handleBookActivity = (activity: Activity) => {
    setCurrentScreen('booking');
  };

  const handleBack = () => {
    if (currentScreen === 'booking') setCurrentScreen('detail');
    else setCurrentScreen('list');
  };

  return (
    <View style={styles.root}>
      {currentScreen === 'list' && (
        <ActivityListScreen onSelect={handleSelectActivity} onCrash={() => setCrashApp(true)} />
      )}
      {currentScreen === 'detail' && selectedActivity && (
        <ActivityDetailScreen activity={selectedActivity} onBack={handleBack} onBook={handleBookActivity} />
      )}
      {currentScreen === 'booking' && selectedActivity && (
        <BookingConfirmationScreen activity={selectedActivity} onBack={handleBack} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9f9f9' },
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red', textAlign: 'center', marginTop: 20 },
  crashButton: {
    backgroundColor: '#333', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center',
  },
  crashButtonText: { color: '#fff', fontWeight: 'bold' },
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sportType: { fontSize: 12, backgroundColor: '#FFF0EA', color: '#FF6B35', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  cardDetail: { fontSize: 14, color: '#666', marginTop: 4 },
  backButton: { marginBottom: 16, paddingVertical: 8 },
  backButtonText: { color: '#FF6B35', fontSize: 16, fontWeight: '600' },
  detailCard: {
    backgroundColor: '#fff', padding: 20, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  detailTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  detailType: { fontSize: 14, color: '#FF6B35', fontWeight: '600', marginBottom: 16 },
  detailDescription: { fontSize: 16, color: '#444', lineHeight: 24, marginBottom: 20 },
  detailInfo: { fontSize: 15, color: '#555', marginBottom: 12 },
  bookButton: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  bookButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statusLabel: { fontSize: 18, fontWeight: '600', color: '#333', marginVertical: 12 },
  successText: { fontSize: 18, color: 'green', fontWeight: 'bold', textAlign: 'center', marginVertical: 16 },
  secondaryButton: { backgroundColor: '#f0f0f0', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
});

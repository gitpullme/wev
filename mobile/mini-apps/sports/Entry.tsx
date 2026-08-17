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
  const [selectedSport, setSelectedSport] = useState('All');
  const { data, isLoading, error } = useQuery({
    queryKey: ['sports-activities'],
    queryFn: async () => {
      const response = await api.get('/api/sports/activities');
      return response.data.data as Activity[];
    },
  });

  if (isLoading) return <ActivityIndicator style={styles.centered} size="large" color="#FF6B35" />;
  if (error) return <Text style={styles.errorText}>Failed to load activities</Text>;

  const filteredData = data?.filter(item => selectedSport === 'All' || item.sportType === selectedSport) || [];
  const sports = ['All', 'Soccer', 'Badminton', 'Ping Pong', 'Tennis', 'Basketball'];

  return (
    <View style={styles.container}>
      <View style={styles.crashBox}>
        <Text style={styles.crashBoxTitle}>🧪 Fault Isolation Sandbox</Text>
        <Text style={styles.crashBoxText}>Tapping below causes a deliberate render crash caught by MiniAppErrorBoundary — other apps stay fully operational.</Text>
        <TouchableOpacity style={styles.crashButton} onPress={onCrash}>
          <Text style={styles.crashButtonText}>🐛 Trigger Crash Test</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sports}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.filterChip, selectedSport === item && styles.filterChipActive]}
              onPress={() => setSelectedSport(item)}
            >
              <Text style={[styles.filterChipText, selectedSport === item && styles.filterChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
      
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const percentFull = (item.bookedCount / item.capacity) * 100;
          const barColor = percentFull < 50 ? '#4CAF50' : percentFull < 80 ? '#FF9800' : '#F44336';
          
          return (
            <TouchableOpacity style={styles.card} onPress={() => onSelect(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.sportType}>{item.sportType}</Text>
              </View>
              <Text style={styles.cardDetail}>📍 {item.location}</Text>
              <Text style={styles.cardDetail}>
                🕒 {new Date(item.startTime).toLocaleTimeString()} - {new Date(item.endTime).toLocaleTimeString()}
              </Text>
              <View style={styles.capacityContainer}>
                <Text style={styles.capacityText}>👥 {item.capacity - item.bookedCount} spots remaining</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${percentFull}%`, backgroundColor: barColor }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
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

  const [showToast, setShowToast] = useState(false);

  const handleBook = async () => {
    try {
      await book({
        activityId: activity.id,
        clientId: `sports-${activity.id}-${Date.now()}`,
      });
      
      // Emit cross-app event through the bridge.
      wev.bridge.emit('booking:created', {
        activityName: activity.title,
        startTime: activity.startTime,
        endTime: activity.endTime,
      });

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
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
        
        <View style={styles.stepperContainer}>
          {['IDLE', 'QUEUED', 'SYNCING', 'SUCCESS'].map((step, idx) => {
            const steps = ['IDLE', 'QUEUED', 'SYNCING', 'SUCCESS'];
            let currentIndex = steps.indexOf(status);
            if (currentIndex === -1) currentIndex = 3;
            const isActive = currentIndex >= idx;
            return (
              <View key={step} style={styles.stepItem}>
                <View style={[styles.stepCircle, isActive && styles.stepCircleActiveSports]}>
                  <Text style={[styles.stepNumber, isActive && styles.stepNumberActive]}>{idx + 1}</Text>
                </View>
                <Text style={styles.stepLabel}>{step === 'SUCCESS' ? 'Result' : step.charAt(0) + step.slice(1).toLowerCase()}</Text>
              </View>
            );
          })}
        </View>

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

      {showToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>📡 WevSDK Bridge: Emitted 'sports:booking:created'</Text>
        </View>
      )}
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
  crashBox: { backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#856404', borderStyle: 'dashed', marginBottom: 16 },
  crashBoxTitle: { color: '#856404', fontWeight: 'bold', marginBottom: 4 },
  crashBoxText: { color: '#856404', fontSize: 13, marginBottom: 8 },
  crashButton: {
    backgroundColor: '#856404', padding: 12, borderRadius: 8, alignItems: 'center',
  },
  crashButtonText: { color: '#fff', fontWeight: 'bold' },
  filterContainer: { marginBottom: 12, height: 40 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eee', marginRight: 8 },
  filterChipActive: { backgroundColor: '#FF6B35' },
  filterChipText: { color: '#333', fontSize: 14, fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sportType: { fontSize: 12, backgroundColor: '#FFF0EA', color: '#FF6B35', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  cardDetail: { fontSize: 14, color: '#666', marginTop: 4 },
  capacityContainer: { marginTop: 12 },
  capacityText: { fontSize: 13, color: '#555', marginBottom: 4 },
  progressBarBg: { height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, width: '100%' },
  progressBarFill: { height: 6, borderRadius: 3 },
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
  statusLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginVertical: 8, textAlign: 'center' },
  successText: { fontSize: 18, color: 'green', fontWeight: 'bold', textAlign: 'center', marginVertical: 16 },
  secondaryButton: { backgroundColor: '#f0f0f0', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
  toast: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#333', padding: 12, borderRadius: 24, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  stepperContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20, paddingHorizontal: 10 },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  stepCircleActiveSports: { backgroundColor: '#FF6B35' },
  stepNumber: { color: '#999', fontWeight: 'bold', fontSize: 12 },
  stepNumberActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: '#666' }
});

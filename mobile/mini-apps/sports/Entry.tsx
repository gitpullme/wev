import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, ScrollView, Animated,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWevSDK } from '../../kernel/bridge/WevSDKContext';
import { api } from '../../src/services/api';
import { useOfflineAwareBooking } from '../../src/booking/useOfflineAwareBooking';
import { clearQueueForType } from '../../src/booking/offlineQueue';
import { useNetworkOverrideStore } from '../../src/stores/networkOverrideStore';
import { v4 as uuid } from 'uuid';

// ─── Types ───────────────────────────────────────────────────────────────────
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

type DemoPhase =
  | 'idle'           // Nothing started
  | 'staging'        // Setting up: going offline, queuing, filling slot
  | 'staged'         // Ready — waiting for user to tap Go Online
  | 'syncing'        // User went online, sync in progress
  | 'conflicted'     // 409 received, conflict shown
  | 'success';       // Normal booking succeeded online

// ─── Crash Test ──────────────────────────────────────────────────────────────
class BuggyComponent extends React.Component {
  render() {
    throw new Error('Deliberate crash for fault isolation test');
    return null;
  }
}

// ─── Activity List Screen ────────────────────────────────────────────────────
function ActivityListScreen({
  onSelect,
  onCrash,
  onStartConflictDemo,
}: {
  onSelect: (a: Activity) => void;
  onCrash: () => void;
  onStartConflictDemo: (a: Activity) => void;
}) {
  const [selectedSport, setSelectedSport] = useState('All');
  const { data, isLoading, error } = useQuery({
    queryKey: ['sports-activities'],
    queryFn: async () => {
      const res = await api.get('/api/sports/activities');
      return res.data.data as Activity[];
    },
  });

  if (isLoading) return <ActivityIndicator style={styles.centered} size="large" color="#FF6B35" />;
  if (error) return <Text style={styles.errorText}>Failed to load activities</Text>;

  const sports = ['All', 'soccer', 'badminton', 'pingpong', 'tennis', 'basketball'];
  const sportLabels: Record<string, string> = {
    All: 'All', soccer: 'Soccer', badminton: 'Badminton',
    pingpong: 'Ping Pong', tennis: 'Tennis', basketball: 'Basketball',
  };
  const filteredData = data?.filter(
    (item) => selectedSport === 'All' || item.sportType === selectedSport,
  ) ?? [];
  const demoActivity = data?.[0] ?? null;

  return (
    <ScrollView style={styles.scrollRoot} contentContainerStyle={styles.scrollContent}>

      {/* ── Conflict Demo Card ──────────────────────────────────────────── */}
      <View style={styles.demoBanner}>
        <View style={styles.demoBannerHeader}>
          <Text style={styles.demoBannerIcon}>⚔️</Text>
          <Text style={styles.demoBannerTitle}>Offline Conflict Demo</Text>
        </View>
        <Text style={styles.demoBannerBody}>
          Simulates the full offline→conflict scenario in 2 taps:{'\n'}
          <Text style={styles.demoBannerStep}>① </Text>Tap the button below → app goes offline, booking queued, slot claimed by "another user".{'\n'}
          <Text style={styles.demoBannerStep}>② </Text>Tap <Text style={styles.demoBannerHighlight}>[📡 Go Online]</Text> in the header above → sync fires → server returns 409 → CONFLICT_REJECTED.
        </Text>
        {demoActivity ? (
          <TouchableOpacity
            style={styles.demoBannerButton}
            onPress={() => onStartConflictDemo(demoActivity)}
          >
            <Text style={styles.demoBannerButtonText}>🚀 Start Conflict Demo with "{demoActivity.title}"</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.demoBannerBody}>No activities loaded yet.</Text>
        )}
      </View>

      {/* ── Fault Isolation Sandbox ─────────────────────────────────────── */}
      <View style={styles.crashBox}>
        <Text style={styles.crashBoxTitle}>🧪 Fault Isolation Sandbox</Text>
        <Text style={styles.crashBoxText}>
          Tapping below causes a deliberate render crash caught by MiniAppErrorBoundary —
          other apps stay fully operational.
        </Text>
        <TouchableOpacity style={styles.crashButton} onPress={onCrash}>
          <Text style={styles.crashButtonText}>🐛 Trigger Crash Test</Text>
        </TouchableOpacity>
      </View>

      {/* ── Sport Filter Chips ──────────────────────────────────────────── */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={sports}
        keyExtractor={(item) => item}
        style={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, selectedSport === item && styles.filterChipActive]}
            onPress={() => setSelectedSport(item)}
          >
            <Text style={[styles.filterChipText, selectedSport === item && styles.filterChipTextActive]}>
              {sportLabels[item]}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Activity Cards ──────────────────────────────────────────────── */}
      {filteredData.map((item) => {
        const pct = (item.bookedCount / item.capacity) * 100;
        const barColor = pct < 50 ? '#4CAF50' : pct < 80 ? '#FF9800' : '#F44336';
        return (
          <TouchableOpacity key={item.id} style={styles.card} onPress={() => onSelect(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.sportType}>{item.sportType}</Text>
            </View>
            <Text style={styles.cardDetail}>📍 {item.location}</Text>
            <Text style={styles.cardDetail}>
              🕒 {new Date(item.startTime).toLocaleDateString()} · {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View style={styles.capacityContainer}>
              <Text style={styles.capacityText}>
                👥 {item.capacity - item.bookedCount} / {item.capacity} spots left
              </Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Activity Detail Screen ───────────────────────────────────────────────────
function ActivityDetailScreen({
  activity, onBack, onBook,
}: {
  activity: Activity; onBack: () => void; onBook: (a: Activity) => void;
}) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>{activity.title}</Text>
        <Text style={styles.detailType}>{activity.sportType}</Text>
        <Text style={styles.detailDescription}>{activity.description}</Text>
        <Text style={styles.detailInfo}>📍 {activity.location}</Text>
        <Text style={styles.detailInfo}>
          🕒 {new Date(activity.startTime).toLocaleDateString()} {new Date(activity.startTime).toLocaleTimeString()} – {new Date(activity.endTime).toLocaleTimeString()}
        </Text>
        <Text style={styles.detailInfo}>
          👥 {activity.bookedCount} / {activity.capacity} booked
        </Text>
        <TouchableOpacity style={styles.bookButton} onPress={() => onBook(activity)}>
          <Text style={styles.bookButtonText}>Book This Session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── State Machine Stepper ────────────────────────────────────────────────────
function Stepper({ currentStatus }: { currentStatus: string }) {
  const isConflict = currentStatus === 'CONFLICT_REJECTED';
  const steps = [
    { key: 'IDLE',   label: 'Idle' },
    { key: 'QUEUED', label: 'Queued' },
    { key: 'SYNCING',label: 'Syncing' },
    { key: isConflict ? 'CONFLICT_REJECTED' : 'SUCCESS',
      label: isConflict ? 'Conflict ✗' : 'Success ✓' },
  ];
  const order = ['IDLE','QUEUED','SYNCING','SUCCESS','CONFLICT_REJECTED'];
  const currentIdx = currentStatus === 'CONFLICT_REJECTED' ? 3 : order.indexOf(currentStatus);
  return (
    <View style={styles.stepperContainer}>
      {steps.map((step, idx) => {
        const active = currentIdx >= idx;
        const isConflictStep = step.key === 'CONFLICT_REJECTED';
        const bg = isConflictStep ? '#D32F2F' : '#FF6B35';
        const isLast = idx === steps.length - 1;
        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, active && { backgroundColor: bg }]}>
                <Text style={[styles.stepNumber, active && { color: '#fff' }]}>{idx + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, active && { color: bg, fontWeight: '700' }]}>
                {step.label}
              </Text>
            </View>
            {!isLast && (
              <View style={[
                styles.stepLine,
                currentIdx > idx && { backgroundColor: isConflict && idx === 2 ? '#D32F2F' : '#FF6B35' },
              ]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Booking Confirmation Screen ──────────────────────────────────────────────
function BookingConfirmationScreen({
  activity,
  onBack,
  conflictDemoMode,
}: {
  activity: Activity;
  onBack: () => void;
  conflictDemoMode: boolean;
}) {
  const wev = useWevSDK();
  const { status, label, book, reset, isOnline, forceSync } = useOfflineAwareBooking({
    miniAppType: 'sports',
    queryKey: ['sports-activities', 'sports-bookings'],
  });

  const [showToast, setShowToast] = useState(false);
  const [demoPhase, setDemoPhase] = useState<'idle' | 'staging' | 'staged' | 'syncing'>('idle');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const setSimulatedOffline = useNetworkOverrideStore((s) => s.setSimulatedOffline);
  const demoRanRef = useRef(false);

  // ── CONFLICT DEMO: single sequential imperative flow, NO cascading effects ──
  // Runs once when conflictDemoMode=true on mount.
  // Steps: clear stale queue → ensure offline → enqueue booking → fill slot on server → done
  useEffect(() => {
    if (!conflictDemoMode || demoRanRef.current) return;
    demoRanRef.current = true;

    const runDemoStaging = async () => {
      setDemoPhase('staging');
      console.log('[ConflictDemo] === STAGING START ===');

      // Step 1: Clear any stale sports queue items from previous runs (Android AsyncStorage persists)
      await clearQueueForType('sports');
      console.log('[ConflictDemo] Cleared stale queue');

      // Step 2: Ensure we are simulated-offline
      setSimulatedOffline(true);
      // Give Zustand + useNetworkStatus one tick to propagate
      await new Promise((r) => setTimeout(r, 200));

      // Step 3: Book while offline — this enqueues to AsyncStorage and sets status=QUEUED
      console.log('[ConflictDemo] Calling book() while offline...');
      await book({ activityId: activity.id, clientId: `conflict-demo-${activity.id}-${Date.now()}` });
      console.log('[ConflictDemo] book() done, should be QUEUED now');

      // Step 4: Fill the slot on the server (real HTTP — device IS actually online)
      console.log('[ConflictDemo] Filling slot server-side...');
      try {
        await api.post(`/api/sports/activities/${activity.id}/debug/fill`);
        console.log('[ConflictDemo] Slot filled successfully');
      } catch (e: any) {
        console.error('[ConflictDemo] Fill failed:', e?.message);
      }

      // Step 5: Done — show the "Go Online & Sync" button
      setDemoPhase('staged');
      console.log('[ConflictDemo] === STAGING COMPLETE — ready for sync ===');
    };

    runDemoStaging();
  }, [conflictDemoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Go Online & Sync: called by the user tapping the button ──
  const handleGoOnlineAndSync = async () => {
    setDemoPhase('syncing');
    console.log('[ConflictDemo] === GOING ONLINE & SYNCING ===');

    // Step 1: Go online
    setSimulatedOffline(false);

    // Step 2: Wait for Zustand + useNetworkStatus to propagate on Android
    await new Promise((r) => setTimeout(r, 600));

    // Step 3: Force-drain the queue (bypasses isSyncingRef lock + suppresses auto-sync)
    console.log('[ConflictDemo] Calling forceSync()...');
    await forceSync();
    console.log('[ConflictDemo] forceSync() done — status should be CONFLICT_REJECTED');
  };

  // ── Normal (non-demo) booking ──
  const handleBook = async () => {
    try {
      await book({ activityId: activity.id, clientId: `sports-${activity.id}-${Date.now()}` });
      if (isOnline) {
        wev.bridge.emit('booking:created', {
          activityName: activity.title,
          startTime: activity.startTime,
          endTime: activity.endTime,
        });
        Animated.sequence([
          Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(2500),
          Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setShowToast(false));
        setShowToast(true);
      }
    } catch (e) {
      console.error('Booking failed', e);
    }
  };

  // ── Manual fill for non-demo usage ──
  const [isFillingSlot, setIsFillingSlot] = useState(false);
  const [manualSlotFilled, setManualSlotFilled] = useState(false);
  const handleManualFill = async () => {
    setIsFillingSlot(true);
    try {
      await api.post(`/api/sports/activities/${activity.id}/debug/fill`);
      setManualSlotFilled(true);
    } catch (e) {
      console.error('Fill failed', e);
    } finally {
      setIsFillingSlot(false);
    }
  };

  const isConflict = status === 'CONFLICT_REJECTED';
  const statusBg = isConflict ? '#FFEBEE'
    : status === 'SUCCESS'  ? '#E8F5E9'
    : status === 'QUEUED'   ? '#FFF8E1'
    : status === 'SYNCING'  ? '#E3F2FD'
    : '#F5F5F5';

  return (
    <ScrollView style={styles.scrollRoot} contentContainerStyle={styles.scrollContent}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>{activity.title}</Text>
        <Text style={styles.detailType}>Booking Flow Visualiser</Text>

        {/* ── State Machine Stepper ────────────────────────────── */}
        <Stepper currentStatus={status} />

        {/* ── Status Card ─────────────────────────────────────── */}
        <View style={[styles.statusCard, { backgroundColor: statusBg }]}>
          <Text style={styles.statusEmoji}>
            {status === 'IDLE'    ? '⏸️'
            : status === 'QUEUED' ? '⏳'
            : status === 'SYNCING'? '🔄'
            : status === 'SUCCESS'? '✅'
            : '❌'}
          </Text>
          <Text style={styles.statusLabel}>{label}</Text>
          <Text style={styles.statusDesc}>
            {status === 'IDLE'     && 'Ready to book. Tap Confirm below.'}
            {status === 'QUEUED' && !isOnline && 'Saved to local queue. Will sync when online.'}
            {status === 'QUEUED' && isOnline  && 'Queued — syncing shortly…'}
            {status === 'SYNCING'  && 'Sending to the server…'}
            {status === 'SUCCESS'  && 'Booking confirmed on the server!'}
            {status === 'CONFLICT_REJECTED' && (
              'Another user booked this slot while you were offline.\nYour booking was rolled back — no charge.'
            )}
          </Text>
        </View>

        {/* ── CONFLICT DEMO: staging in progress ──────────────── */}
        {conflictDemoMode && demoPhase === 'staging' && (
          <View style={styles.conflictBox}>
            <View style={styles.conflictRowCenter}>
              <ActivityIndicator size="small" color="#E65100" />
              <Text style={styles.conflictFillText}>  Setting up conflict scenario…</Text>
            </View>
          </View>
        )}

        {/* ── CONFLICT DEMO: staged — ready for Go Online ─────── */}
        {conflictDemoMode && demoPhase === 'staged' && status === 'QUEUED' && (
          <View style={styles.conflictBox}>
            <View style={styles.conflictReadyBanner}>
              <Text style={styles.conflictReadyIcon}>🎯</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.conflictReadyTitle}>Conflict Staged!</Text>
                <Text style={styles.conflictReadyBody}>
                  Your booking is queued locally.{'\n'}
                  The slot has been filled by "another user" on the server.{'\n\n'}
                  Tap the button below to go online — the sync will POST your booking,
                  the server will return <Text style={{ fontWeight: '900' }}>409 Conflict</Text>,
                  and the state machine will transition to CONFLICT_REJECTED.
                </Text>
                <TouchableOpacity style={styles.goOnlineBtn} onPress={handleGoOnlineAndSync}>
                  <Text style={styles.goOnlineBtnText}>📡 Go Online &amp; Trigger Sync</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── CONFLICT DEMO: syncing in progress ─────────────── */}
        {conflictDemoMode && demoPhase === 'syncing' && status === 'SYNCING' && (
          <View style={styles.conflictBox}>
            <View style={styles.conflictRowCenter}>
              <ActivityIndicator size="small" color="#1565C0" />
              <Text style={[styles.conflictFillText, { color: '#1565C0' }]}>
                  Syncing… waiting for server response
              </Text>
            </View>
          </View>
        )}

        {/* ── NON-DEMO: manual conflict simulator ────────────── */}
        {!conflictDemoMode && status === 'QUEUED' && !isOnline && (
          <View style={styles.conflictBox}>
            {!manualSlotFilled && !isFillingSlot && (
              <>
                <Text style={styles.conflictBoxTitle}>⚔️ Conflict Simulator</Text>
                <Text style={styles.conflictBoxBody}>
                  Fill the slot server-side to simulate another user, then go online.
                </Text>
                <TouchableOpacity style={styles.conflictFillBtn} onPress={handleManualFill}>
                  <Text style={styles.conflictFillBtnText}>⚔️ Fill Slot — Simulate Another User</Text>
                </TouchableOpacity>
              </>
            )}
            {isFillingSlot && (
              <View style={styles.conflictRowCenter}>
                <ActivityIndicator size="small" color="#E65100" />
                <Text style={styles.conflictFillText}>  Filling slot…</Text>
              </View>
            )}
            {manualSlotFilled && (
              <View style={styles.conflictReadyBanner}>
                <Text style={styles.conflictReadyIcon}>🎯</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.conflictReadyTitle}>Slot Filled!</Text>
                  <Text style={styles.conflictReadyBody}>
                    Tap below to go online and trigger the 409 conflict.
                  </Text>
                  <TouchableOpacity
                    style={styles.goOnlineBtn}
                    onPress={async () => {
                      setSimulatedOffline(false);
                      await new Promise((r) => setTimeout(r, 600));
                      await forceSync();
                    }}
                  >
                    <Text style={styles.goOnlineBtnText}>📡 Go Online &amp; Trigger Sync</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── CONFLICT RESULT ──────────────────────────────── */}
        {isConflict && (
          <View style={styles.conflictResultCard}>
            <Text style={styles.conflictResultIcon}>❌</Text>
            <Text style={styles.conflictResultTitle}>409 CONFLICT — Slot Taken</Text>
            <View style={styles.conflictTimeline}>
              <View style={styles.conflictTimelineRow}>
                <View style={[styles.tlDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.tlText}>You went offline & queued a booking</Text>
              </View>
              <View style={styles.conflictTimelineLine} />
              <View style={styles.conflictTimelineRow}>
                <View style={[styles.tlDot, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.tlText}>Another user booked the last slot online</Text>
              </View>
              <View style={styles.conflictTimelineLine} />
              <View style={styles.conflictTimelineRow}>
                <View style={[styles.tlDot, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.tlText}>You came back online → sync fired</Text>
              </View>
              <View style={styles.conflictTimelineLine} />
              <View style={styles.conflictTimelineRow}>
                <View style={[styles.tlDot, { backgroundColor: '#D32F2F' }]} />
                <Text style={styles.tlText}>Server returned 409 → booking rolled back</Text>
              </View>
              <View style={styles.conflictTimelineLine} />
              <View style={styles.conflictTimelineRow}>
                <View style={[styles.tlDot, { backgroundColor: '#9C27B0' }]} />
                <Text style={styles.tlText}>State → CONFLICT_REJECTED, queue cleared</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.conflictRetryBtn}
              onPress={() => { reset(); onBack(); }}
            >
              <Text style={styles.conflictRetryBtnText}>← Try Another Activity</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── NORMAL ACTIONS ───────────────────────────────── */}
        {status === 'IDLE' && !conflictDemoMode && (
          <TouchableOpacity style={styles.bookButton} onPress={handleBook}>
            <Text style={styles.bookButtonText}>Confirm Booking</Text>
          </TouchableOpacity>
        )}
        {status === 'SUCCESS' && (
          <View>
            <Text style={styles.successText}>🎉 Booking Confirmed!</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => { reset(); onBack(); }}>
              <Text style={styles.secondaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Bridge Toast ─────────────────────────────────────── */}
      {showToast && (
        <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
          <Text style={styles.toastText}>📡 WevSDK Bridge: Emitted 'sports:booking:created'</Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

// ─── Root Entry ───────────────────────────────────────────────────────────────
export default function SportsEntry() {
  const [screen, setScreen] = useState<'list' | 'detail' | 'booking'>('list');
  const [selected, setSelected] = useState<Activity | null>(null);
  const [conflictDemoMode, setConflictDemoMode] = useState(false);
  const [crash, setCrash] = useState(false);
  const setSimulatedOffline = useNetworkOverrideStore((s) => s.setSimulatedOffline);

  if (crash) return <BuggyComponent />;

  const handleStartConflictDemo = async (activity: Activity) => {
    // 1. Force offline
    setSimulatedOffline(true);
    // 2. Navigate directly to booking screen in demo mode
    setSelected(activity);
    setConflictDemoMode(true);
    setScreen('booking');
    // The BookingConfirmationScreen will auto-queue + auto-fill when it mounts
    // and status transitions to QUEUED
  };

  return (
    <View style={styles.root}>
      {screen === 'list' && (
        <ActivityListScreen
          onSelect={(a) => { setSelected(a); setConflictDemoMode(false); setScreen('detail'); }}
          onCrash={() => setCrash(true)}
          onStartConflictDemo={handleStartConflictDemo}
        />
      )}
      {screen === 'detail' && selected && (
        <ActivityDetailScreen
          activity={selected}
          onBack={() => setScreen('list')}
          onBook={(a) => { setSelected(a); setConflictDemoMode(false); setScreen('booking'); }}
        />
      )}
      {screen === 'booking' && selected && (
        <BookingConfirmationScreen
          activity={selected}
          onBack={() => { setScreen(conflictDemoMode ? 'list' : 'detail'); setConflictDemoMode(false); }}
          conflictDemoMode={conflictDemoMode}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9f9f9' },
  scrollRoot: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red', textAlign: 'center', marginTop: 20 },

  // ── Conflict Demo Banner ────────────────────────────
  demoBanner: {
    backgroundColor: '#1A237E', borderRadius: 14, padding: 16, marginBottom: 14,
  },
  demoBannerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  demoBannerIcon: { fontSize: 22, marginRight: 8 },
  demoBannerTitle: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  demoBannerBody: { fontSize: 12, color: '#C5CAE9', lineHeight: 19, marginBottom: 14 },
  demoBannerStep: { fontWeight: '900', color: '#7986CB' },
  demoBannerHighlight: { fontWeight: '900', color: '#64B5F6' },
  demoBannerButton: {
    backgroundColor: '#E53935', borderRadius: 10, paddingVertical: 12,
    paddingHorizontal: 16, alignItems: 'center',
  },
  demoBannerButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // ── Fault Isolation Box ─────────────────────────────
  crashBox: {
    backgroundColor: '#FFF3CD', padding: 12, borderRadius: 10, borderWidth: 1,
    borderColor: '#856404', borderStyle: 'dashed', marginBottom: 14,
  },
  crashBoxTitle: { color: '#856404', fontWeight: '800', marginBottom: 4, fontSize: 13 },
  crashBoxText: { color: '#856404', fontSize: 12, marginBottom: 8, lineHeight: 17 },
  crashButton: { backgroundColor: '#856404', padding: 10, borderRadius: 8, alignItems: 'center' },
  crashButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // ── Filter Chips ────────────────────────────────────
  filterList: { marginBottom: 14 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#eee', marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#FF6B35' },
  filterChipText: { color: '#333', fontSize: 13, fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  // ── Activity Card ────────────────────────────────────
  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#222', flex: 1 },
  sportType: {
    fontSize: 11, backgroundColor: '#FFF0EA', color: '#FF6B35',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontWeight: '600',
  },
  cardDetail: { fontSize: 13, color: '#666', marginTop: 3 },
  capacityContainer: { marginTop: 10 },
  capacityText: { fontSize: 12, color: '#555', marginBottom: 4 },
  progressBarBg: { height: 5, backgroundColor: '#E0E0E0', borderRadius: 3 },
  progressBarFill: { height: 5, borderRadius: 3 },

  // ── Detail / Booking screens ─────────────────────────
  backButton: { marginBottom: 14 },
  backButtonText: { color: '#FF6B35', fontSize: 15, fontWeight: '600' },
  detailCard: {
    backgroundColor: '#fff', padding: 20, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  detailTitle: { fontSize: 22, fontWeight: '800', color: '#222', marginBottom: 4 },
  detailType: { fontSize: 13, color: '#FF6B35', fontWeight: '600', marginBottom: 14 },
  detailDescription: { fontSize: 14, color: '#555', lineHeight: 21, marginBottom: 16 },
  detailInfo: { fontSize: 14, color: '#555', marginBottom: 10 },
  bookButton: {
    backgroundColor: '#FF6B35', padding: 15, borderRadius: 10,
    alignItems: 'center', marginTop: 20,
  },
  bookButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  successText: { fontSize: 18, color: '#2E7D32', fontWeight: '800', textAlign: 'center', marginVertical: 14 },
  secondaryButton: {
    backgroundColor: '#f0f0f0', padding: 14, borderRadius: 10,
    alignItems: 'center', marginTop: 10,
  },
  secondaryButtonText: { color: '#333', fontSize: 14, fontWeight: '600' },

  // ── State Machine Stepper ─────────────────────────────
  stepperContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 20, paddingHorizontal: 4,
  },
  stepItem: { alignItems: 'center' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E0E0E0', marginBottom: 18 },
  stepCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#E0E0E0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  stepNumber: { color: '#999', fontWeight: '700', fontSize: 13 },
  stepLabel: { fontSize: 10, color: '#aaa', textAlign: 'center', maxWidth: 54 },

  // ── Status Card ───────────────────────────────────────
  statusCard: {
    borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 14,
  },
  statusEmoji: { fontSize: 32, marginBottom: 8 },
  statusLabel: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 4 },
  statusDesc: { fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 19 },

  // ── Conflict Simulator Box (QUEUED + offline) ─────────
  conflictBox: {
    borderWidth: 1.5, borderColor: '#FF6D00', borderStyle: 'dashed',
    borderRadius: 12, padding: 14, marginBottom: 14, backgroundColor: '#FFF8F0',
  },
  conflictBoxTitle: { fontSize: 14, fontWeight: '800', color: '#E65100', marginBottom: 6 },
  conflictBoxBody: { fontSize: 12, color: '#BF360C', lineHeight: 18, marginBottom: 12 },
  conflictFillBtn: {
    backgroundColor: '#D32F2F', padding: 12, borderRadius: 8, alignItems: 'center',
  },
  conflictFillBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  conflictRowCenter: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  conflictFillText: { fontSize: 13, color: '#E65100', fontWeight: '600' },

  // Staged / ready banner
  conflictReadyBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12,
  },
  conflictReadyIcon: { fontSize: 24, marginRight: 10, marginTop: 2 },
  conflictReadyTitle: { fontSize: 14, fontWeight: '800', color: '#0D47A1', marginBottom: 4 },
  conflictReadyBody: { fontSize: 12, color: '#1565C0', lineHeight: 18, marginBottom: 10 },
  goOnlineBtn: {
    backgroundColor: '#1565C0', borderRadius: 8, paddingVertical: 10,
    paddingHorizontal: 16, alignItems: 'center', marginTop: 4,
  },
  goOnlineBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // ── CONFLICT RESULT card ──────────────────────────────
  conflictResultCard: {
    backgroundColor: '#FFEBEE', borderRadius: 12, padding: 16,
    marginTop: 4, marginBottom: 4, alignItems: 'center',
  },
  conflictResultIcon: { fontSize: 36, marginBottom: 8 },
  conflictResultTitle: {
    fontSize: 15, fontWeight: '900', color: '#B71C1C',
    marginBottom: 14, letterSpacing: 0.5,
  },
  // Timeline
  conflictTimeline: { alignSelf: 'stretch', marginBottom: 16 },
  conflictTimelineRow: { flexDirection: 'row', alignItems: 'center' },
  tlDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  tlText: { fontSize: 12, color: '#444', flex: 1, lineHeight: 17 },
  conflictTimelineLine: {
    width: 2, height: 12, backgroundColor: '#BDBDBD',
    marginLeft: 4, marginVertical: 2,
  },
  conflictRetryBtn: {
    backgroundColor: '#D32F2F', paddingVertical: 12,
    paddingHorizontal: 24, borderRadius: 10,
  },
  conflictRetryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // ── Toast ─────────────────────────────────────────────
  toast: {
    position: 'absolute', bottom: 30, left: 16, right: 16,
    backgroundColor: '#212121', padding: 12, borderRadius: 24, alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

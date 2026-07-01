import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Callout, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Colors';
import {
  AchievementRow,
  getAllUniqueAchievementNames,
  getUniqueEarnedAchievements,
  getTripCostEstimate,
  getPlansByStatus,
  getSetting,
  PlanRow,
  TripCostEstimate,
} from '@/lib/db';
import { useBase, useSentinel } from '@/hooks/useBase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACHIEVEMENT_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'Yellowstone Arrival':   { latitude: 45.02955,   longitude: -110.70870 },
  'Mount Washburn Summit': { latitude: 44.7854936, longitude: -110.4540905 },
};

const US_REGION = {
  latitude: 39.5, longitude: -98.35,
  latitudeDelta: 30, longitudeDelta: 55,
};

const RING_SIZE   = 180;
const STROKE      = 14;
const RADIUS      = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatHM(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  if (hh === 0) return `${mm}m`;
  if (mm === 0) return `${hh}h`;
  return `${hh}h ${mm}m`;
}

function budgetRingColor(pct: number): string {
  if (pct > 0.60) return Theme.moss;
  if (pct > 0.30) return Theme.gold;
  return Theme.rust;
}

type BudgetData = {
  tripBudget: number | null;
  activePlan: PlanRow | null;
  estimate: TripCostEstimate | null;
};

function readBudgetData(): BudgetData {
  const raw = getSetting('tripBudget', '');
  const tripBudget = raw ? parseFloat(raw) : null;
  const plans = getPlansByStatus('current');
  const activePlan = plans.length > 0 ? plans[0] : null;
  const estimate = activePlan ? getTripCostEstimate(activePlan.id) : null;
  return { tripBudget, activePlan, estimate };
}

// ---------------------------------------------------------------------------
// Zone 1 — Sentinel Card
// ---------------------------------------------------------------------------
function SentinelCard({ lastLoggedAt }: { lastLoggedAt: number | null }) {
  const { hours, state } = useSentinel(lastLoggedAt);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'danger') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [state]);

  let bg: string;
  let heading: string;
  let sub: string;
  let headingColor = Theme.cream;

  if (!lastLoggedAt) {
    bg      = Theme.surface;
    heading = 'Log your spot';
    sub     = 'Sentinel inactive';
  } else if (state === 'ok') {
    bg      = '#2A3D2A';
    heading = "You're covered";
    sub     = `Parked ${formatHM(hours)} ago`;
  } else if (state === 'warning') {
    bg      = '#3D2E10';
    heading = 'Plan your exit';
    sub     = `${formatHM(24 - hours)} remaining`;
    headingColor = Theme.gold;
  } else {
    bg      = '#3D1A1A';
    heading = 'Move now';
    sub     = `${formatHM(hours - 24)} over limit`;
    headingColor = Theme.rust;
  }

  return (
    <Animated.View style={[styles.sentinelCard, { backgroundColor: bg, opacity: state === 'danger' ? pulse : 1 }]}>
      <Text style={[styles.sentinelHeading, { color: headingColor }]}>{heading}</Text>
      <Text style={styles.sentinelSub}>{sub}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Zone 2 — Budget Ring
// ---------------------------------------------------------------------------
function BudgetRing({ data }: { data: BudgetData }) {
  const { tripBudget, activePlan, estimate } = data;

  if (!tripBudget) {
    return (
      <View style={styles.budgetEmpty}>
        <Text style={styles.budgetEmptyText}>Set your trip budget in Settings</Text>
      </View>
    );
  }

  const hasEstimate = estimate !== null && estimate.numDays > 1;
  const dayNumber   = activePlan?.current_sleep_day ?? 1;
  const spent       = hasEstimate ? Math.max(0, (dayNumber - 1) * estimate!.perDay) : 0;
  const remaining   = tripBudget - spent;
  const pct         = Math.max(0, Math.min(1, remaining / tripBudget));
  const color       = budgetRingColor(pct);
  const offset      = CIRCUMFERENCE * (1 - pct);

  return (
    <View style={styles.ringSection}>
      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            stroke={Theme.border} strokeWidth={STROKE} fill="none"
          />
          <Circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            stroke={color} strokeWidth={STROKE} fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={[styles.ringAmount, { color }]}>${Math.round(remaining)}</Text>
          <Text style={styles.ringCap}>of ${Math.round(tripBudget)} budget</Text>
        </View>
      </View>
      {hasEstimate ? (
        <Text style={styles.ringMeta}>
          ~${Math.round(estimate!.perDay)}/day · Day {dayNumber} of {estimate!.numDays}
        </Text>
      ) : (
        <Text style={styles.ringMeta}>Load a plan to track spending</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Zone 3 — Achievements Strip
// ---------------------------------------------------------------------------
function AchievementsStrip({ onPress }: { onPress: () => void }) {
  const all    = getAllUniqueAchievementNames();
  const earned = new Set(getUniqueEarnedAchievements().map(r => r.name));
  if (all.length === 0) return null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={styles.achieveWrap}>
        <Text style={styles.achieveHeader}>ACHIEVEMENTS</Text>
        {all.map(a => {
          const done = earned.has(a.name);
          return (
            <View key={a.name} style={styles.achieveRow}>
              <Text style={[styles.achieveMark, done ? styles.achieveMarkEarned : styles.achieveMarkLocked]}>
                {done ? '✓' : '○'}
              </Text>
              <Text style={[styles.achieveName, done ? styles.achieveNameEarned : styles.achieveNameLocked]}>
                {a.name}
              </Text>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Achievements Map Modal
// ---------------------------------------------------------------------------
function AchievementsMapModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const earnedRows = getUniqueEarnedAchievements();
  const earnedMap  = new Map(earnedRows.map(r => [r.name, r.earned_at]));

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <MapView
          style={{ flex: 1 }}
          provider={PROVIDER_DEFAULT}
          mapType="hybrid"
          initialRegion={US_REGION}
          showsUserLocation={false}
        >
          {Object.entries(ACHIEVEMENT_COORDS).map(([name, coord]) => {
            const earned_at = earnedMap.get(name);
            const isEarned  = earned_at !== undefined;
            const subtitle  = isEarned
              ? `Earned ${new Date(earned_at!).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Locked';
            return (
              <Marker key={name} coordinate={coord} pinColor={isEarned ? Theme.gold : Theme.muted}>
                <Callout tooltip={false}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutName}>{name}</Text>
                    <Text style={styles.calloutSub}>{subtitle}</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
        <SafeAreaView style={styles.closeWrap} pointerEvents="box-none">
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Achievement Toast
// ---------------------------------------------------------------------------
function AchievementToast({ achievement }: { achievement: AchievementRow }) {
  return (
    <View style={styles.toast} pointerEvents="none">
      <Text style={styles.toastStar}>★</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.toastLabel}>ACHIEVEMENT UNLOCKED</Text>
        <Text style={styles.toastName}>{achievement.name}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function BaseScreen() {
  const { lastLoggedAt, challengeMode, newAchievements, locStatus, logSpot, refresh } = useBase();
  const [mapVisible,   setMapVisible]   = useState(false);
  const [budgetData,   setBudgetData]   = useState<BudgetData>(readBudgetData);

  useFocusEffect(useCallback(() => {
    refresh();
    setBudgetData(readBudgetData());
  }, [refresh]));

  function handleStripPress() {
    if (!challengeMode) {
      Alert.alert('Challenge Mode', 'Enable Challenge Mode in Settings to view the achievement map.');
      return;
    }
    setMapVisible(true);
  }

  function logLabel(): string {
    switch (locStatus) {
      case 'logging':            return 'LOGGING…';
      case 'done':               return '✓ LOGGED';
      case 'permission-denied':  return 'ENABLE LOCATION';
      case 'gps-error':          return 'GPS TIMEOUT';
      case 'db-error':           return 'SAVE FAILED';
      default:                   return '+ LOG';
    }
  }

  return (
    <View style={styles.root}>
      <AchievementsMapModal visible={mapVisible} onClose={() => setMapVisible(false)} />

      {newAchievements.length > 0 && (
        <AchievementToast achievement={newAchievements[0]} />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Zone 1 — Sentinel */}
        <SentinelCard lastLoggedAt={lastLoggedAt} />
        <TouchableOpacity
          style={[styles.logBtn, locStatus === 'logging' && styles.logBtnActive]}
          onPress={logSpot}
          disabled={locStatus === 'logging'}
          activeOpacity={0.8}
        >
          <Text style={styles.logBtnText}>{logLabel()}</Text>
        </TouchableOpacity>

        {/* Zone 2 — Budget Ring */}
        <BudgetRing data={budgetData} />

        {/* Zone 3 — Achievements */}
        {challengeMode && <AchievementsStrip onPress={handleStripPress} />}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Theme.charcoal },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 16 },

  // Sentinel
  sentinelCard:    { borderRadius: 16, padding: 28, minHeight: 140, justifyContent: 'center', borderWidth: 1, borderColor: Theme.border },
  sentinelHeading: { fontFamily: 'Archivo-Bold', fontSize: 26, marginBottom: 8 },
  sentinelSub:     { fontFamily: 'Archivo', fontSize: 13, color: Theme.muted },

  // Log button
  logBtn:       { backgroundColor: Theme.rust, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  logBtnActive: { opacity: 0.6 },
  logBtnText:   { fontFamily: 'Archivo-Bold', fontSize: 14, color: Theme.cream, letterSpacing: 1.2 },

  // Budget ring
  ringSection: { alignItems: 'center', paddingVertical: 12 },
  ringWrap:    { width: RING_SIZE, height: RING_SIZE, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  ringCenter:  { position: 'absolute', alignItems: 'center' },
  ringAmount:  { fontFamily: 'Archivo-Bold', fontSize: 28 },
  ringCap:     { fontFamily: 'Archivo', fontSize: 12, color: Theme.muted, marginTop: 2 },
  ringMeta:    { fontFamily: 'Archivo', fontSize: 12, color: Theme.muted },
  budgetEmpty: { alignItems: 'center', paddingVertical: 28 },
  budgetEmptyText: { fontFamily: 'Archivo', fontSize: 13, color: Theme.muted },

  // Achievements strip
  achieveWrap:         { marginTop: 8, marginBottom: 8 },
  achieveHeader:       { fontFamily: 'Archivo-SemiBold', fontSize: 10, color: Theme.muted, letterSpacing: 1.5, marginBottom: 10 },
  achieveRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Theme.border },
  achieveMark:         { fontFamily: 'Archivo-Bold', fontSize: 13, marginRight: 10 },
  achieveMarkEarned:   { color: Theme.gold },
  achieveMarkLocked:   { color: Theme.muted },
  achieveName:         { fontFamily: 'Archivo-SemiBold', fontSize: 13 },
  achieveNameEarned:   { color: Theme.cream },
  achieveNameLocked:   { color: Theme.muted },

  // Map modal
  closeWrap:    { position: 'absolute', top: 0, right: 0, left: 0, alignItems: 'flex-end', paddingRight: 16 },
  closeBtn:     { backgroundColor: Theme.charcoal, borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Theme.border },
  closeBtnText: { color: Theme.cream, fontSize: 15, fontFamily: 'Archivo-SemiBold' },
  callout:      { paddingHorizontal: 10, paddingVertical: 6, minWidth: 160 },
  calloutName:  { fontFamily: 'Archivo-Bold', fontSize: 13, color: '#1C1F22', marginBottom: 2 },
  calloutSub:   { fontFamily: 'Archivo', fontSize: 12, color: '#6B6B6B' },

  // Achievement toast
  toast: {
    position: 'absolute', top: 0, left: 16, right: 16, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.gold,
    borderRadius: 12, padding: 14,
  },
  toastStar:  { fontSize: 22, color: Theme.gold },
  toastLabel: { fontFamily: 'Archivo-SemiBold', fontSize: 9, color: Theme.gold, letterSpacing: 1.4, marginBottom: 2 },
  toastName:  { fontFamily: 'Archivo-Bold', fontSize: 14, color: Theme.cream },
});

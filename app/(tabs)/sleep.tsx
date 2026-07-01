import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Colors';
import { getActivePlanSleepData, setSleepDay, ActivePlanSleepData, PlanSleepSpotRow } from '@/lib/db';

function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SWIPE_THRESHOLD = 80;

function SwipeCurrentRow({ children, onAdvance }: { children: React.ReactNode; onAdvance: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && g.dx > 4,
      onPanResponderMove: (_, g) => {
        translateX.setValue(Math.min(SWIPE_THRESHOLD, Math.max(0, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD / 2) {
          Animated.spring(translateX, { toValue: SWIPE_THRESHOLD, useNativeDriver: true }).start(() => {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            onAdvance();
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={{ overflow: 'hidden' }}>
      <View style={styles.doneStrip}>
        <Text style={styles.doneStripText}>✓ Done</Text>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

type SpotState = 'past' | 'current' | 'future';

function SpotRow({ spot, spotState, label, distMi }: {
  spot: PlanSleepSpotRow;
  spotState: SpotState;
  label: string;
  distMi: number | null;
}) {
  const isPast    = spotState === 'past';
  const isCurrent = spotState === 'current';

  return (
    <View style={[styles.spotRow, isCurrent && styles.spotRowCurrent, isPast && styles.spotRowPast]}>
      <Text style={styles.spotLabel}>{label}</Text>
      <View style={styles.spotNameRow}>
        <Text style={[styles.spotName, isPast && styles.spotNamePast]} numberOfLines={2}>
          {spot.name}
        </Text>
        {isCurrent && distMi !== null && (
          <Text style={styles.spotDist}>{distMi.toFixed(1)} mi</Text>
        )}
      </View>
      {spot.notes ? <Text style={styles.spotNotes} numberOfLines={4}>{spot.notes}</Text> : null}
    </View>
  );
}

export default function SleepScreen() {
  const [data, setData]     = useState<ActivePlanSleepData | null | undefined>(undefined);
  const [distMi, setDistMi] = useState<number | null>(null);

  const load = useCallback(() => {
    const d = getActivePlanSleepData();
    setData(d);
    setDistMi(null);
    if (!d) return;
    const current = d.spots.find(s => s.day_number === d.currentDay) ?? d.spots[0];
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setDistMi(haversineMi(loc.coords.latitude, loc.coords.longitude, current.lat, current.lon));
      } catch {}
    })();
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (data === undefined) return null;

  if (!data || data.spots.length === 0) {
    return (
      <View style={styles.root}>
        <Text style={styles.emptyText}>No sleep spots yet — load a plan first.</Text>
      </View>
    );
  }

  const maxDay = Math.max(...data.spots.map(s => s.day_number));

  function handleAdvance() {
    if (!data) return;
    if (data.currentDay >= maxDay) {
      Alert.alert('Trip complete', 'Mark your plan done in the PLAN tab.');
      return;
    }
    setSleepDay(data.planId, data.currentDay + 1);
    load();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.header}>SLEEP · Night {data.currentDay} of {maxDay}</Text>

      {data.spots.map(spot => {
        const spotState: SpotState =
          spot.day_number < data.currentDay  ? 'past'    :
          spot.day_number === data.currentDay ? 'current' : 'future';
        const inner = (
          <SpotRow
            spot={spot}
            spotState={spotState}
            label={`Night ${spot.day_number}`}
            distMi={spotState === 'current' ? distMi : null}
          />
        );
        return spotState === 'current' ? (
          <SwipeCurrentRow key={spot.id} onAdvance={handleAdvance}>{inner}</SwipeCurrentRow>
        ) : (
          <View key={spot.id}>{inner}</View>
        );
      })}

      {data.currentDay <= maxDay && (
        <Text style={styles.hint}>Swipe right on tonight's spot when you're done</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Theme.charcoal },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 10 },
  header:  { fontFamily: 'Archivo-SemiBold', fontSize: 10, color: Theme.muted, letterSpacing: 1.5, marginBottom: 4 },
  emptyText: { fontFamily: 'Archivo', fontSize: 14, color: Theme.muted, paddingHorizontal: 20, paddingTop: 32 },
  hint:    { fontFamily: 'Archivo', fontSize: 11, color: Theme.muted, opacity: 0.5, textAlign: 'center', marginTop: 8 },

  // Done strip (revealed from left on swipe)
  doneStrip:     { position: 'absolute', left: 0, top: 0, bottom: 0, width: SWIPE_THRESHOLD, backgroundColor: '#2A3D2A', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  doneStripText: { fontFamily: 'Archivo-Bold', fontSize: 12, color: Theme.moss, letterSpacing: 0.5 },

  // Spot rows
  spotRow:        { backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border, borderRadius: 12, padding: 14 },
  spotRowCurrent: { backgroundColor: '#1E2D1E', borderColor: Theme.moss },
  spotRowPast:    { opacity: 0.35 },
  spotLabel:      { fontFamily: 'Archivo-SemiBold', fontSize: 9, color: Theme.muted, letterSpacing: 1.4, marginBottom: 5 },
  spotNameRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 5 },
  spotName:       { fontFamily: 'Archivo-Bold', fontSize: 15, color: Theme.cream, flex: 1, marginRight: 8 },
  spotNamePast:   { textDecorationLine: 'line-through' },
  spotDist:       { fontFamily: 'Archivo-SemiBold', fontSize: 12, color: Theme.muted, paddingTop: 2 },
  spotNotes:      { fontFamily: 'Archivo', fontSize: 13, color: Theme.muted, lineHeight: 19 },
});

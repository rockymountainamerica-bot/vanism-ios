import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Colors';
import { getActivePlanSleepData, setSleepDay, ActivePlanSleepData, PlanSleepSpotRow } from '@/lib/db';

function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ComingSoon({ title }: { title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.comingSoonBox}>
        <Text style={styles.comingSoonText}>Coming soon</Text>
      </View>
    </View>
  );
}

function activeSpot(data: ActivePlanSleepData): PlanSleepSpotRow {
  return data.spots.find(s => s.day_number === data.currentDay) ?? data.spots[0];
}

export default function SleepScreen() {
  const [data, setData] = useState<ActivePlanSleepData | null | undefined>(undefined);
  const [distMi, setDistMi] = useState<number | null>(null);

  const load = useCallback(() => {
    const d = getActivePlanSleepData();
    setData(d);
    setDistMi(null);
    if (!d) return;
    const spot = activeSpot(d);
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDistMi(haversineMi(loc.coords.latitude, loc.coords.longitude, spot.lat, spot.lon));
    })();
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (data === undefined) return null;

  const spot   = data ? activeSpot(data) : null;
  const maxDay = data ? Math.max(...data.spots.map(s => s.day_number)) : 1;

  function nextStop() {
    if (!data || data.currentDay >= maxDay) return;
    setSleepDay(data.planId, data.currentDay + 1);
    load();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>SLEEP SPOT</Text>
          {data && data.spots.length > 1 && (
            <Text style={styles.dayLabel}>Day {data.currentDay} of {maxDay}</Text>
          )}
        </View>
        {spot ? (
          <View style={styles.spotCard}>
            <View style={styles.spotHeader}>
              <Text style={styles.spotName}>{spot.name}</Text>
              <Text style={styles.dist}>{distMi != null ? `${distMi.toFixed(1)} mi` : '— mi'}</Text>
            </View>
            {spot.notes ? <Text style={styles.spotNotes}>{spot.notes}</Text> : null}
            {data && data.currentDay < maxDay && (
              <TouchableOpacity style={styles.nextBtn} onPress={nextStop}>
                <Text style={styles.nextBtnText}>Next Stop →</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={styles.emptyText}>No sleep spot yet — load a plan first.</Text>
        )}
      </View>

      <ComingSoon title="SLEEP LOG" />
      <ComingSoon title="NOISE MONITOR" />
      <ComingSoon title="TEMP ALERT" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.charcoal, paddingHorizontal: 20 },
  section: { marginTop: 24 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionHeader: { fontFamily: 'Archivo-SemiBold', fontSize: 10, color: Theme.muted, letterSpacing: 1.5 },
  dayLabel: { fontFamily: 'Archivo-SemiBold', fontSize: 10, color: Theme.rust, letterSpacing: 0.8 },
  emptyText: { fontFamily: 'Archivo', fontSize: 14, color: Theme.muted },
  spotCard: { borderWidth: 1, borderColor: Theme.border, borderRadius: 10, padding: 14, backgroundColor: Theme.surface },
  spotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  spotName: { fontFamily: 'Archivo-SemiBold', fontSize: 15, color: Theme.gold, flex: 1 },
  dist: { fontFamily: 'Archivo', fontSize: 12, color: Theme.muted, marginLeft: 12 },
  spotNotes: { fontFamily: 'Archivo', fontSize: 13, color: Theme.muted, lineHeight: 19 },
  nextBtn: { marginTop: 12, borderTopWidth: 1, borderTopColor: Theme.border, paddingTop: 10, alignItems: 'center' },
  nextBtnText: { fontFamily: 'Archivo-Bold', fontSize: 12, color: Theme.rust, letterSpacing: 0.6 },
  comingSoonBox: { borderWidth: 1, borderColor: Theme.border, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  comingSoonText: { fontFamily: 'Archivo', fontSize: 13, color: Theme.muted, fontStyle: 'italic' },
});

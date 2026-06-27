import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Colors';
import { getActivePlanSleepSpot, PlanSleepSpotRow } from '@/lib/db';

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

export default function SleepScreen() {
  const [spot, setSpot] = useState<PlanSleepSpotRow | null | undefined>(undefined);
  const [distMi, setDistMi] = useState<number | null>(null);

  const load = useCallback(() => {
    const s = getActivePlanSleepSpot();
    setSpot(s);
    setDistMi(null);
    if (!s) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDistMi(haversineMi(loc.coords.latitude, loc.coords.longitude, s.lat, s.lon));
    })();
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (spot === undefined) return null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SLEEP SPOT</Text>
        {spot ? (
          <View style={styles.spotCard}>
            <View style={styles.spotHeader}>
              <Text style={styles.spotName}>{spot.name}</Text>
              <Text style={styles.dist}>{distMi != null ? `${distMi.toFixed(1)} mi` : '— mi'}</Text>
            </View>
            {spot.notes ? <Text style={styles.spotNotes}>{spot.notes}</Text> : null}
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
  sectionHeader: { fontFamily: 'Archivo-SemiBold', fontSize: 10, color: Theme.muted, letterSpacing: 1.5, marginBottom: 8 },
  emptyText: { fontFamily: 'Archivo', fontSize: 14, color: Theme.muted },
  spotCard: { borderWidth: 1, borderColor: Theme.border, borderRadius: 10, padding: 14, backgroundColor: Theme.surface },
  spotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  spotName: { fontFamily: 'Archivo-SemiBold', fontSize: 15, color: Theme.gold, flex: 1 },
  dist: { fontFamily: 'Archivo', fontSize: 12, color: Theme.muted, marginLeft: 12 },
  spotNotes: { fontFamily: 'Archivo', fontSize: 13, color: Theme.muted, lineHeight: 19 },
  comingSoonBox: { borderWidth: 1, borderColor: Theme.border, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  comingSoonText: { fontFamily: 'Archivo', fontSize: 13, color: Theme.muted, fontStyle: 'italic' },
});

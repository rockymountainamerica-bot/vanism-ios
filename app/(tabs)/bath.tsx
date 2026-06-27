import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Theme } from '@/constants/Colors';
import { getHotSprings, HotSpringRow } from '@/lib/db';

function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type SpringWithDist = HotSpringRow & { distMi: number | null };

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function ComingSoon({ title }: { title: string }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <View style={styles.comingSoonBox}>
        <Text style={styles.comingSoonText}>Coming soon</Text>
      </View>
    </View>
  );
}

export default function BathScreen() {
  const [springs, setSprings] = useState<SpringWithDist[]>([]);

  useEffect(() => {
    const rows = getHotSprings();
    setSprings(rows.map(r => ({ ...r, distMi: null })));

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setSprings(
        rows
          .map(r => ({ ...r, distMi: haversineMi(latitude, longitude, r.lat, r.lon) }))
          .sort((a, b) => (a.distMi ?? Infinity) - (b.distMi ?? Infinity))
      );
    })();
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.section}>
        <SectionHeader title="HOT SPRINGS" />
        {springs.map(s => (
          <View key={s.id} style={styles.row}>
            <Text style={styles.springName}>{s.name}</Text>
            <Text style={styles.dist}>
              {s.distMi != null ? `${s.distMi.toFixed(1)} mi` : '— mi'}
            </Text>
          </View>
        ))}
      </View>

      <ComingSoon title="SHOWERS" />
      <ComingSoon title="LAUNDRY" />
      <ComingSoon title="WATER REFILL" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.charcoal, paddingHorizontal: 20 },
  section: { marginTop: 24 },
  sectionHeader: {
    fontFamily: 'Archivo-SemiBold',
    fontSize: 10,
    color: Theme.muted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  springName: { fontFamily: 'Archivo-SemiBold', fontSize: 14, color: Theme.gold, flex: 1 },
  dist: { fontFamily: 'Archivo', fontSize: 12, color: Theme.muted, marginLeft: 12 },
  comingSoonBox: {
    borderWidth: 1,
    borderColor: Theme.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  comingSoonText: { fontFamily: 'Archivo', fontSize: 13, color: Theme.muted, fontStyle: 'italic' },
});

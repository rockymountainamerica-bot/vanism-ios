import { useCallback, useEffect, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Colors';
import { getPlansByStatus, PlanRow } from '@/lib/db';

function formatDriveTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

type SectionDef = { title: string; status: PlanRow['status']; emptyLabel: string };

const SECTION_DEFS: SectionDef[] = [
  { title: 'CURRENT',  status: 'current',  emptyLabel: 'No current route' },
  { title: 'UPCOMING', status: 'upcoming', emptyLabel: 'No upcoming routes' },
  { title: 'PAST',     status: 'past',     emptyLabel: 'No past routes' },
];

function PlanItem({ item }: { item: PlanRow }) {
  const date = new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <View style={styles.routeLine}>
          <Text style={styles.location}>{item.origin}</Text>
          <Text style={styles.arrow}> → </Text>
          <Text style={styles.location}>{item.destination}</Text>
        </View>
        <Text style={styles.meta}>{item.distance_miles} mi · {formatDriveTime(item.drive_time_minutes)}</Text>
      </View>
      <Text style={styles.date}>{date}</Text>
    </View>
  );
}

type SectionData = { title: string; emptyLabel: string; data: (PlanRow | null)[] };

export default function PlanScreen() {
  const [sections, setSections] = useState<SectionData[]>([]);

  const load = useCallback(() => {
    setSections(
      SECTION_DEFS.map(s => {
        const rows = getPlansByStatus(s.status);
        return { title: s.title, emptyLabel: s.emptyLabel, data: rows.length > 0 ? rows : [null] };
      })
    );
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SectionList
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 40 }}
      sections={sections}
      keyExtractor={(item, i) => (item ? String(item.id) : `empty-${i}`)}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item, section }) =>
        item ? (
          <PlanItem item={item} />
        ) : (
          <Text style={styles.empty}>{(section as SectionData).emptyLabel}</Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.charcoal, paddingHorizontal: 20 },
  sectionHeader: { fontFamily: 'Archivo-SemiBold', fontSize: 10, color: Theme.muted, letterSpacing: 1.5, marginTop: 24, marginBottom: 8 },
  empty: { fontFamily: 'Archivo', fontSize: 14, color: Theme.muted, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Theme.border },
  routeLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  location: { fontFamily: 'Archivo-SemiBold', fontSize: 14, color: Theme.cream },
  arrow: { fontFamily: 'Archivo-Bold', fontSize: 14, color: Theme.rust },
  meta: { fontFamily: 'Archivo', fontSize: 11, color: Theme.muted, marginTop: 2 },
  date: { fontFamily: 'Archivo', fontSize: 11, color: Theme.muted, marginLeft: 12 },
});

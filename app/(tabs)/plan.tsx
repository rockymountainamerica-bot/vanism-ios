import { useCallback, useEffect, useState } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
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

const markdownStyles = {
  body: { color: Theme.muted, fontFamily: 'Archivo', fontSize: 13, lineHeight: 20 },
  strong: { color: Theme.cream, fontFamily: 'Archivo-Bold' },
  bullet_list: { marginVertical: 2 },
  list_item: { marginVertical: 1 },
  heading1: { color: Theme.cream, fontFamily: 'Archivo-Bold', fontSize: 14, marginVertical: 4 },
  heading2: { color: Theme.cream, fontFamily: 'Archivo-Bold', fontSize: 13, marginVertical: 4 },
  code_inline: { backgroundColor: Theme.charcoal, color: Theme.cream, fontFamily: 'Courier', fontSize: 12 },
};

type SectionDef = { title: string; status: PlanRow['status']; emptyLabel: string };

const SECTION_DEFS: SectionDef[] = [
  { title: 'CURRENT',  status: 'current',  emptyLabel: 'No current route' },
  { title: 'UPCOMING', status: 'upcoming', emptyLabel: 'No upcoming routes' },
  { title: 'PAST',     status: 'past',     emptyLabel: 'No past routes' },
];

function PlanItem({ item, expanded, onPress }: { item: PlanRow; expanded: boolean; onPress: () => void }) {
  const date = new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
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
      {expanded && item.notes && (
        <View style={styles.notesWrap}>
          <View style={styles.divider} />
          <Markdown style={markdownStyles}>{item.notes}</Markdown>
        </View>
      )}
    </TouchableOpacity>
  );
}

type SectionData = { title: string; emptyLabel: string; data: (PlanRow | null)[] };

export default function PlanScreen() {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
          <PlanItem
            item={item}
            expanded={expandedId === item.id}
            onPress={() => setExpandedId(prev => (prev === item.id ? null : item.id))}
          />
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
  notesWrap: { paddingBottom: 16, paddingTop: 4 },
  divider: { height: 1, backgroundColor: Theme.border, marginBottom: 12 },
});

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Colors';
import { getActivePlanActivities, ActivityCategoryWithSpots, ActivitySpotRow } from '@/lib/db';

function SpotRow({ spot }: { spot: ActivitySpotRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity onPress={() => setExpanded(p => !p)} activeOpacity={0.7}>
      <View style={styles.spotRow}>
        <Text style={styles.spotName}>{spot.name}</Text>
        <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
      </View>
      {expanded && spot.notes ? (
        <Text style={styles.spotNotes}>{spot.notes}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function CategoryCard({ entry }: { entry: ActivityCategoryWithSpots }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => setExpanded(p => !p)} activeOpacity={0.7}>
        <View style={styles.categoryRow}>
          <Text style={styles.categoryName}>{entry.category.name.toUpperCase()}</Text>
          <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.spotList}>
          {entry.spots.map(spot => (
            <SpotRow key={spot.id} spot={spot} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function ActivityScreen() {
  const [entries, setEntries] = useState<ActivityCategoryWithSpots[] | undefined>(undefined);

  const load = useCallback(() => {
    setEntries(getActivePlanActivities());
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (entries === undefined) return null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACTIVITIES</Text>
        {entries.length > 0 ? (
          entries.map(entry => (
            <CategoryCard key={entry.category.id} entry={entry} />
          ))
        ) : (
          <Text style={styles.emptyText}>No activities yet — load a plan first.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.charcoal, paddingHorizontal: 20 },
  section: { marginTop: 24 },
  sectionHeader: { fontFamily: 'Archivo-SemiBold', fontSize: 10, color: Theme.muted, letterSpacing: 1.5, marginBottom: 10 },
  emptyText: { fontFamily: 'Archivo', fontSize: 14, color: Theme.muted },
  card: { borderWidth: 1, borderColor: Theme.border, borderRadius: 10, backgroundColor: Theme.surface, marginBottom: 10, overflow: 'hidden' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  categoryName: { fontFamily: 'Archivo-Bold', fontSize: 12, color: Theme.cream, letterSpacing: 1.2 },
  chevron: { fontFamily: 'Archivo-Bold', fontSize: 16, color: Theme.rust },
  spotList: { borderTopWidth: 1, borderTopColor: Theme.border, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  spotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  spotName: { fontFamily: 'Archivo-SemiBold', fontSize: 13, color: Theme.gold, flex: 1 },
  spotNotes: { fontFamily: 'Archivo', fontSize: 12, color: Theme.muted, lineHeight: 18, paddingBottom: 8 },
});

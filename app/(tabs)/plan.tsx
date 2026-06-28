import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useFocusEffect } from 'expo-router';
import { Theme } from '@/constants/Colors';
import {
  getPlansByStatus,
  PlanRow,
  PlanSleepSpotRow,
  PlanBathSpotRow,
  SpotInput,
  completePlan,
  promotePlanToCurrent,
  upsertPlanSleepSpot,
  upsertPlanBathSpot,
  getSleepSpotForPlan,
  getBathSpotForPlan,
} from '@/lib/db';

const API_URL = 'https://vanism-ai.vercel.app/api/copilot';
const SPOTS_RE = /---SPOTS---\n([\s\S]*?)\n---END---/;

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

type LoadState = 'idle' | 'loading' | 'error';

function SpotSection({ label, spot }: { label: string; spot: PlanSleepSpotRow | PlanBathSpotRow }) {
  return (
    <>
      <View style={styles.divider} />
      <Text style={styles.spotLabel}>{label}</Text>
      <Text style={styles.spotName}>{spot.name}</Text>
      {spot.notes ? <Text style={styles.spotNotes}>{spot.notes}</Text> : null}
    </>
  );
}

function PlanItem({
  item,
  expanded,
  loadState,
  onPress,
  onLoad,
  onComplete,
}: {
  item: PlanRow;
  expanded: boolean;
  loadState: LoadState;
  onPress: () => void;
  onLoad: () => void;
  onComplete: () => void;
}) {
  const date = new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const sleepSpot = expanded ? getSleepSpotForPlan(item.id) : null;
  const bathSpot  = expanded ? getBathSpotForPlan(item.id)  : null;

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
        {item.status === 'current' && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={onComplete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.completeBtnText}>Done</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.loadBtn, loadState === 'error' && styles.loadBtnError]}
          onPress={onLoad}
          disabled={loadState === 'loading'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {loadState === 'loading' ? (
            <ActivityIndicator size="small" color={Theme.cream} />
          ) : (
            <Text style={styles.loadBtnText}>
              {loadState === 'error' ? 'Retry' : 'Load'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={styles.notesWrap}>
          {item.notes && (
            <>
              <View style={styles.divider} />
              <Markdown style={markdownStyles}>{item.notes}</Markdown>
            </>
          )}
          {sleepSpot && <SpotSection label="SLEEP" spot={sleepSpot} />}
          {bathSpot  && <SpotSection label="BATH"  spot={bathSpot}  />}
        </View>
      )}
    </TouchableOpacity>
  );
}

type SectionData = { title: string; emptyLabel: string; data: (PlanRow | null)[] };

export default function PlanScreen() {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
  const [errorPlanId, setErrorPlanId] = useState<number | null>(null);

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

  async function loadSpots(plan: PlanRow) {
    setLoadingPlanId(plan.id);
    setErrorPlanId(null);

    const prompt = `I need one sleep spot and one bath spot for a drive from ${plan.origin} to ${plan.destination} (${plan.distance_miles} mi, ~${formatDriveTime(plan.drive_time_minutes)} drive). Reply with ONLY the following block — no other text:
---SPOTS---
{"sleep_spot":{"name":"<name>","lat":<number>,"lon":<number>,"notes":"<1-2 sentences>"},"bath_spot":{"name":"<name>","lat":<number>,"lon":<number>,"notes":"<1-2 sentences>"}}
---END---`;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      const raw: string = data.reply ?? '';
      const match = raw.match(SPOTS_RE);
      if (!match) throw new Error('no spots block');
      const spots = JSON.parse(match[1]) as { sleep_spot: SpotInput; bath_spot: SpotInput };
      if (!spots.sleep_spot || !spots.bath_spot) throw new Error('missing spots');

      upsertPlanSleepSpot(plan.id, spots.sleep_spot);
      upsertPlanBathSpot(plan.id, spots.bath_spot);

      if (plan.status === 'upcoming') {
        promotePlanToCurrent(plan.id);
      }

      load();
    } catch {
      setErrorPlanId(plan.id);
    } finally {
      setLoadingPlanId(null);
    }
  }

  function handleComplete(plan: PlanRow) {
    completePlan(plan.id);
    load();
  }

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
            loadState={
              loadingPlanId === item.id ? 'loading'
              : errorPlanId === item.id ? 'error'
              : 'idle'
            }
            onPress={() => setExpandedId(prev => (prev === item.id ? null : item.id))}
            onLoad={() => loadSpots(item)}
            onComplete={() => handleComplete(item)}
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
  loadBtn: { backgroundColor: Theme.rust, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 12, marginLeft: 10, minWidth: 52, alignItems: 'center', justifyContent: 'center' },
  loadBtnError: { backgroundColor: Theme.muted },
  loadBtnText: { fontFamily: 'Archivo-Bold', fontSize: 11, color: Theme.cream, letterSpacing: 0.5 },
  completeBtn: { borderWidth: 1, borderColor: Theme.border, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10, marginLeft: 10 },
  completeBtnText: { fontFamily: 'Archivo-Bold', fontSize: 11, color: Theme.muted, letterSpacing: 0.5 },
  notesWrap: { paddingBottom: 16, paddingTop: 4 },
  divider: { height: 1, backgroundColor: Theme.border, marginVertical: 10 },
  spotLabel: { fontFamily: 'Archivo-SemiBold', fontSize: 9, color: Theme.muted, letterSpacing: 1.4, marginBottom: 4 },
  spotName: { fontFamily: 'Archivo-SemiBold', fontSize: 13, color: Theme.cream, marginBottom: 3 },
  spotNotes: { fontFamily: 'Archivo', fontSize: 13, color: Theme.muted, lineHeight: 19 },
});

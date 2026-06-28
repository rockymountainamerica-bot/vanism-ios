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
  MultiDaySpotInput,
  ValidatedActivityCategory,
  ValidatedActivitySpot,
  completePlan,
  promotePlanToCurrent,
  upsertPlanSleepSpots,
  upsertPlanBathSpots,
  upsertPlanActivities,
  getSleepSpotForPlan,
  getBathSpotForPlan,
} from '@/lib/db';

const API_URL = 'https://vanism-ai.vercel.app/api/copilot';
const SPOTS_RE      = /---SPOTS---\n([\s\S]*?)\n---END---/;
const ACTIVITIES_RE = /---ACTIVITIES---\n([\s\S]*?)\n---END---/;

function parseSpotsArray(raw: unknown): MultiDaySpotInput[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).reduce<MultiDaySpotInput[]>((acc, s, i) => {
    if (
      s !== null && typeof s === 'object' &&
      typeof (s as any).name === 'string' &&
      typeof (s as any).lat === 'number' &&
      typeof (s as any).lon === 'number'
    ) {
      acc.push({
        name: (s as any).name,
        lat: (s as any).lat,
        lon: (s as any).lon,
        notes: typeof (s as any).notes === 'string' ? (s as any).notes : '',
        day_number: typeof (s as any).day_number === 'number' ? (s as any).day_number : i + 1,
      });
    }
    return acc;
  }, []);
}

function parseActivities(raw: string): ValidatedActivityCategory[] {
  const match = raw.match(ACTIVITIES_RE);
  if (!match) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(match[1]); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const result: ValidatedActivityCategory[] = [];
  for (const cat of parsed as unknown[]) {
    if (typeof (cat as any)?.category !== 'string' || !Array.isArray((cat as any)?.spots)) continue;
    const validSpots: ValidatedActivitySpot[] = ((cat as any).spots as unknown[]).reduce<ValidatedActivitySpot[]>((acc, s) => {
      if (
        s !== null && typeof s === 'object' &&
        typeof (s as any).name === 'string' &&
        typeof (s as any).lat === 'number' &&
        typeof (s as any).lon === 'number'
      ) {
        acc.push({ name: (s as any).name, lat: (s as any).lat, lon: (s as any).lon, notes: typeof (s as any).notes === 'string' ? (s as any).notes : '' });
      }
      return acc;
    }, []);
    if (validSpots.length === 0) continue;
    result.push({ name: (cat as any).category, spots: validSpots });
  }
  return result;
}

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

    const numSleepStops = Math.max(1, Math.ceil(plan.drive_time_minutes / 330) - 1);
    const numBathStops  = numSleepStops;

    const prompt = `I need overnight stop recommendations for a drive from ${plan.origin} to ${plan.destination} (${plan.distance_miles} mi, ~${formatDriveTime(plan.drive_time_minutes)} drive).

Generate exactly ${numSleepStops} sleep stop${numSleepStops > 1 ? 's' : ''} (day_number 1–${numSleepStops}) and ${numBathStops} bath stop${numBathStops > 1 ? 's' : ''} (day_number 1–${numBathStops}), spaced evenly along the route — not clustered near one end. Include 2-3 activity categories with 2-3 specific named spots each, genuinely suited to this route.

Reply with ONLY these two blocks in order — no other text:
---SPOTS---
{"sleep_spots":[{"name":"<name>","lat":<number>,"lon":<number>,"notes":"<1-2 sentences>","day_number":1}],"bath_spots":[{"name":"<name>","lat":<number>,"lon":<number>,"notes":"<1-2 sentences>","day_number":1}]}
---END---
---ACTIVITIES---
[{"category":"<type>","spots":[{"name":"<name>","lat":<number>,"lon":<number>,"notes":"<1-2 sentences>"}]}]
---END---`;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      const raw: string = data.reply ?? '';

      const spotsMatch = raw.match(SPOTS_RE);
      if (!spotsMatch) throw new Error('no spots block');
      const spotsJson = JSON.parse(spotsMatch[1]);

      const sleepSpots = parseSpotsArray(spotsJson?.sleep_spots);
      if (sleepSpots.length === 0) throw new Error('no valid sleep spots');
      upsertPlanSleepSpots(plan.id, sleepSpots);

      // Bath parsed independently — skip silently if missing/malformed
      const bathSpots = parseSpotsArray(spotsJson?.bath_spots);
      if (bathSpots.length > 0) upsertPlanBathSpots(plan.id, bathSpots);

      // Activities independent — failure never blocks sleep/bath
      const activities = parseActivities(raw);
      if (activities.length > 0) upsertPlanActivities(plan.id, activities);

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

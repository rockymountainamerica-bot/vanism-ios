import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  BudgetRow,
  getLastSpot,
  getTodayBudgetLogs,
  getSetting,
  insertBudgetLog,
  insertSpot,
  setSetting,
} from '@/lib/db';

export const DAILY_BUDGET = 60;

// Parses "$12.50 coffee" or "coffee $12.50" or "12.50 coffee"
const AMOUNT_RE = /\$?(\d+(?:\.\d{1,2})?)/;

export function parseSpend(raw: string): { amount: number; item: string } | null {
  const match = raw.match(AMOUNT_RE);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  const item = raw.replace(match[0], '').trim() || 'Unnamed';
  return { amount, item };
}

function hoursAgo(ts: number): number {
  return (Date.now() - ts) / 3_600_000;
}

export type SentinelState = 'ok' | 'warning' | 'danger';

export function useSentinel(lastLoggedAt: number | null): { hours: number; state: SentinelState } {
  const hours = lastLoggedAt ? hoursAgo(lastLoggedAt) : Infinity;
  const state: SentinelState = hours >= 24 ? 'danger' : hours >= 20 ? 'warning' : 'ok';
  return { hours, state };
}

export function ringColor(pct: number): string {
  if (pct >= 0.9) return '#B5512C'; // rust
  if (pct >= 0.7) return '#D89A4A'; // gold
  return '#5C6650';                  // moss
}

export function useBase() {
  const [logs, setLogs] = useState<BudgetRow[]>([]);
  const [todaySpend, setTodaySpend] = useState(0);
  const [lastLoggedAt, setLastLoggedAt] = useState<number | null>(null);
  const [studioMode, setStudioModeState] = useState(false);
  const [locStatus, setLocStatus] = useState<'idle' | 'logging' | 'done' | 'permission-denied' | 'gps-error' | 'db-error'>('idle');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    const rows = getTodayBudgetLogs();
    setLogs(rows);
    setTodaySpend(rows.reduce((s, r) => s + r.amount, 0));
    const spot = getLastSpot();
    if (spot) setLastLoggedAt(spot.logged_at);
  }, []);

  useEffect(() => {
    // Load persisted studio mode
    setStudioModeState(getSetting('studioMode', 'false') === 'true');
    refresh();
    // Refresh sentinel every minute
    tickRef.current = setInterval(refresh, 60_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [refresh]);

  const logSpot = useCallback(async () => {
    setLocStatus('logging');

    let status: string;
    try {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    } catch (err) {
      console.warn('[logSpot] permission request threw:', err);
      setLocStatus('permission-denied');
      setTimeout(() => setLocStatus('idle'), 3000);
      return;
    }
    if (status !== 'granted') {
      console.warn('[logSpot] permission denied, status:', status);
      setLocStatus('permission-denied');
      setTimeout(() => setLocStatus('idle'), 3000);
      return;
    }

    let loc: Location.LocationObject;
    try {
      loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch (err) {
      console.warn('[logSpot] GPS fetch failed:', err);
      setLocStatus('gps-error');
      setTimeout(() => setLocStatus('idle'), 3000);
      return;
    }

    try {
      insertSpot(loc.coords.latitude, loc.coords.longitude);
    } catch (err) {
      console.warn('[logSpot] DB write failed:', err);
      setLocStatus('db-error');
      setTimeout(() => setLocStatus('idle'), 3000);
      return;
    }

    setLastLoggedAt(Date.now());
    setLocStatus('done');
    setTimeout(() => setLocStatus('idle'), 2000);
  }, []);

  const logSpend = useCallback((raw: string) => {
    const parsed = parseSpend(raw);
    if (!parsed) return false;
    insertBudgetLog(parsed.amount, parsed.item);
    refresh();
    return true;
  }, [refresh]);

  const toggleStudio = useCallback(() => {
    setStudioModeState(prev => {
      const next = !prev;
      setSetting('studioMode', String(next));
      return next;
    });
  }, []);

  return { logs, todaySpend, lastLoggedAt, studioMode, locStatus, logSpot, logSpend, toggleStudio, refresh };
}

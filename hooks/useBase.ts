import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  AchievementRow,
  checkAndAwardAchievements,
  getLastSpot,
  getSetting,
  insertSpot,
} from '@/lib/db';

function hoursAgo(ts: number): number {
  return (Date.now() - ts) / 3_600_000;
}

export type SentinelState = 'ok' | 'warning' | 'danger';

export function useSentinel(lastLoggedAt: number | null): { hours: number; state: SentinelState } {
  const hours = lastLoggedAt ? hoursAgo(lastLoggedAt) : Infinity;
  const state: SentinelState = hours >= 24 ? 'danger' : hours >= 20 ? 'warning' : 'ok';
  return { hours, state };
}

export function useBase() {
  const [lastLoggedAt, setLastLoggedAt] = useState<number | null>(null);
  const [challengeMode, setChallengeMode] = useState(false);
  const [newAchievements, setNewAchievements] = useState<AchievementRow[]>([]);
  const [locStatus, setLocStatus] = useState<'idle' | 'logging' | 'done' | 'permission-denied' | 'gps-error' | 'db-error'>('idle');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    const spot = getLastSpot();
    if (spot) setLastLoggedAt(spot.logged_at);
    setChallengeMode(getSetting('challengeModeEnabled', '0') === '1');
  }, []);

  useEffect(() => {
    refresh();
    tickRef.current = setInterval(refresh, 60_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [refresh]);

  const logSpot = useCallback(async () => {
    setLocStatus('logging');

    let status: string;
    try {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    } catch {
      setLocStatus('permission-denied');
      setTimeout(() => setLocStatus('idle'), 3000);
      return;
    }
    if (status !== 'granted') {
      setLocStatus('permission-denied');
      setTimeout(() => setLocStatus('idle'), 3000);
      return;
    }

    let loc: Location.LocationObject;
    try {
      loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch {
      setLocStatus('gps-error');
      setTimeout(() => setLocStatus('idle'), 3000);
      return;
    }

    try {
      insertSpot(loc.coords.latitude, loc.coords.longitude);
    } catch {
      setLocStatus('db-error');
      setTimeout(() => setLocStatus('idle'), 3000);
      return;
    }

    setLastLoggedAt(Date.now());
    setLocStatus('done');
    setTimeout(() => setLocStatus('idle'), 2000);

    if (getSetting('challengeModeEnabled', '0') === '1') {
      const earned = checkAndAwardAchievements(loc.coords.latitude, loc.coords.longitude);
      if (earned.length > 0) {
        setNewAchievements(earned);
        setTimeout(() => setNewAchievements([]), 4000);
      }
    }
  }, []);

  return { lastLoggedAt, challengeMode, newAchievements, locStatus, logSpot, refresh };
}

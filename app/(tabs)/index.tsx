import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Theme } from '@/constants/Colors';
import { DAILY_BUDGET, ringColor, useBase, useSentinel } from '@/hooks/useBase';

// ---------------------------------------------------------------------------
// Status Ring
// ---------------------------------------------------------------------------
const RING_SIZE = 180;
const STROKE = 14;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function StatusRing({ spend }: { spend: number }) {
  const pct = Math.min(spend / DAILY_BUDGET, 1);
  const color = ringColor(pct);
  const offset = CIRCUMFERENCE * (1 - pct);

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
          stroke={Theme.border} strokeWidth={STROKE} fill="none"
        />
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
          stroke={color} strokeWidth={STROKE} fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringAmount, { color }]}>${spend.toFixed(2)}</Text>
        <Text style={styles.ringCap}>of ${DAILY_BUDGET}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sentinel Badge
// ---------------------------------------------------------------------------
function SentinelBadge({ lastLoggedAt }: { lastLoggedAt: number | null }) {
  const { hours, state } = useSentinel(lastLoggedAt);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'danger') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [state]);

  if (!lastLoggedAt) return (
    <View style={[styles.badge, { borderColor: Theme.muted }]}>
      <Text style={[styles.badgeText, { color: Theme.muted }]}>No LOG yet today</Text>
    </View>
  );

  const h = Math.floor(hours);
  const color = state === 'danger' ? Theme.rust : state === 'warning' ? Theme.gold : Theme.cream;
  const label = state === 'danger'
    ? `Move Required · ${h}h`
    : state === 'warning'
    ? `Exit Strategy · ${h}h`
    : `Parked ${h}h ago`;

  return (
    <Animated.View style={[styles.badge, { borderColor: color, opacity: state === 'danger' ? pulse : 1 }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Spend Input
// ---------------------------------------------------------------------------
function SpendInput({ onSubmit, onCancel }: { onSubmit: (raw: string) => boolean; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(false);

  function submit() {
    const ok = onSubmit(text.trim());
    if (!ok) { setError(true); setTimeout(() => setError(false), 1500); return; }
    setText('');
    Keyboard.dismiss();
    onCancel();
  }

  return (
    <View style={styles.spendRow}>
      <TextInput
        style={[styles.spendInput, error && { borderColor: Theme.rust }]}
        placeholder='e.g. "coffee $4.50" or "$12 gas"'
        placeholderTextColor={Theme.muted}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        returnKeyType="done"
        autoFocus
      />
      <TouchableOpacity style={styles.spendConfirm} onPress={submit}>
        <Text style={styles.spendConfirmText}>LOG IT</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function BaseScreen() {
  const { logs, todaySpend, lastLoggedAt, studioMode, locStatus, logSpot, logSpend, toggleStudio } = useBase();
  const [spendOpen, setSpendOpen] = useState(false);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Ring */}
      <StatusRing spend={todaySpend} />

      {/* Sentinel */}
      <SentinelBadge lastLoggedAt={lastLoggedAt} />

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={logSpot} disabled={locStatus === 'logging'}>
          <Text style={styles.actionLabel}>
            {locStatus === 'logging'             ? 'LOGGING…'
              : locStatus === 'done'             ? '✓ LOGGED'
              : locStatus === 'permission-denied' ? 'ENABLE LOCATION'
              : locStatus === 'gps-error'        ? 'GPS TIMEOUT'
              : locStatus === 'db-error'         ? 'SAVE FAILED'
              : '+ LOG'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, studioMode && styles.actionBtnActive]} onPress={toggleStudio}>
          <Text style={[styles.actionLabel, studioMode && { color: Theme.rust }]}>STUDIO</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setSpendOpen(v => !v)}>
          <Text style={styles.actionLabel}>$ SPEND</Text>
        </TouchableOpacity>
      </View>

      {/* Spend Input */}
      {spendOpen && (
        <SpendInput
          onSubmit={raw => logSpend(raw)}
          onCancel={() => setSpendOpen(false)}
        />
      )}

      {/* Today's Log */}
      <FlatList
        data={logs}
        keyExtractor={r => String(r.id)}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <Text style={styles.listHeader}>TODAY'S SPEND</Text>
        }
        ListEmptyComponent={
          <Text style={styles.listEmpty}>No spend logged yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.logRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logItem}>{item.item}</Text>
              <Text style={styles.logTime}>
                {new Date(item.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={styles.logAmount}>${item.amount.toFixed(2)}</Text>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.charcoal, alignItems: 'center', paddingTop: 24 },

  // Ring
  ringWrap: { width: RING_SIZE, height: RING_SIZE, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringAmount: { fontFamily: 'Archivo-Bold', fontSize: 28 },
  ringCap: { fontFamily: 'Archivo', fontSize: 12, color: Theme.muted, marginTop: 2 },

  // Sentinel
  badge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 20 },
  badgeText: { fontFamily: 'Archivo-SemiBold', fontSize: 12, letterSpacing: 0.6 },

  // Action bar
  actionBar: { flexDirection: 'row', gap: 10, marginBottom: 16, paddingHorizontal: 20 },
  actionBtn: { flex: 1, borderWidth: 1, borderColor: Theme.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: Theme.surface },
  actionBtnActive: { borderColor: Theme.rust },
  actionLabel: { fontFamily: 'Archivo-SemiBold', fontSize: 12, color: Theme.cream, letterSpacing: 0.8 },

  // Spend input
  spendRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12, width: '100%' },
  spendInput: { flex: 1, backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Theme.cream, fontFamily: 'Archivo' },
  spendConfirm: { backgroundColor: Theme.rust, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  spendConfirmText: { fontFamily: 'Archivo-Bold', fontSize: 12, color: Theme.cream, letterSpacing: 0.8 },

  // List
  list: { width: '100%', paddingHorizontal: 20 },
  listHeader: { fontFamily: 'Archivo-SemiBold', fontSize: 10, color: Theme.muted, letterSpacing: 1.5, marginBottom: 10 },
  listEmpty: { fontFamily: 'Archivo', fontSize: 14, color: Theme.muted, textAlign: 'center', marginTop: 8 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Theme.border },
  logItem: { fontFamily: 'Archivo-SemiBold', fontSize: 14, color: Theme.cream },
  logTime: { fontFamily: 'Archivo', fontSize: 11, color: Theme.muted, marginTop: 2 },
  logAmount: { fontFamily: 'Archivo-Bold', fontSize: 15, color: Theme.gold },
});

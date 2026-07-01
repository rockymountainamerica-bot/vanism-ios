import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Theme } from '@/constants/Colors';
import { getSetting, setSetting } from '@/lib/db';

export default function SettingsScreen() {
  const [challengeMode, setChallengeMode] = useState(
    getSetting('challengeModeEnabled', '0') === '1'
  );
  const [vehicleName, setVehicleName] = useState(getSetting('vehicleName', ''));
  const [vehicleMpg, setVehicleMpg]   = useState(getSetting('vehicleMpg', ''));

  function toggleChallengeMode(val: boolean) {
    setSetting('challengeModeEnabled', val ? '1' : '0');
    setChallengeMode(val);
  }

  return (
    <View style={styles.root}>
      <Text style={styles.section}>CHALLENGE MODE</Text>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Challenge Mode</Text>
          <Text style={styles.rowDesc}>
            Unlocks achievements as you reach national parks, summits, and landmarks.
          </Text>
        </View>
        <Switch
          value={challengeMode}
          onValueChange={toggleChallengeMode}
          trackColor={{ false: Theme.border, true: Theme.rust }}
          thumbColor={Theme.cream}
          ios_backgroundColor={Theme.border}
        />
      </View>

      <Text style={[styles.section, { marginTop: 28 }]}>MY VEHICLE</Text>
      <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: 14 }]}>
        <View>
          <Text style={styles.rowLabel}>Vehicle Name</Text>
          <TextInput
            style={styles.input}
            value={vehicleName}
            onChangeText={setVehicleName}
            onEndEditing={() => setSetting('vehicleName', vehicleName.trim())}
            placeholder="e.g. 2019 Ford Transit 250"
            placeholderTextColor={Theme.muted}
            returnKeyType="done"
          />
        </View>
        <View>
          <Text style={styles.rowLabel}>Estimated MPG</Text>
          <TextInput
            style={styles.input}
            value={vehicleMpg}
            onChangeText={setVehicleMpg}
            onEndEditing={() => setSetting('vehicleMpg', vehicleMpg.trim())}
            placeholder="e.g. 16"
            placeholderTextColor={Theme.muted}
            keyboardType="numeric"
            returnKeyType="done"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.charcoal, paddingHorizontal: 20, paddingTop: 24 },
  section: { fontFamily: 'Archivo-SemiBold', fontSize: 10, color: Theme.muted, letterSpacing: 1.5, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border, borderRadius: 12, padding: 16 },
  rowText: { flex: 1, marginRight: 16 },
  rowLabel: { fontFamily: 'Archivo-SemiBold', fontSize: 14, color: Theme.cream, marginBottom: 6 },
  rowDesc: { fontFamily: 'Archivo', fontSize: 12, color: Theme.muted, lineHeight: 18 },
  input: { fontFamily: 'Archivo', fontSize: 14, color: Theme.cream, borderWidth: 1, borderColor: Theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Theme.charcoal },
});

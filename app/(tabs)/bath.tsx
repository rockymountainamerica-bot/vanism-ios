import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/Colors';

export default function BathScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>BATH</Text>
      <Text style={styles.sub}>Showers, laundry & water sources</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.charcoal, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Archivo-Bold', fontSize: 28, color: Theme.cream, letterSpacing: 2 },
  sub: { fontFamily: 'Archivo', fontSize: 14, color: Theme.muted, marginTop: 8 },
});

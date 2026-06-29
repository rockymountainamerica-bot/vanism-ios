import { useFonts } from 'expo-font';
import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { Theme } from '@/constants/Colors';
import { runMigrations } from '@/lib/db';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Archivo: Archivo_400Regular,
    'Archivo-SemiBold': Archivo_600SemiBold,
    'Archivo-Bold': Archivo_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      runMigrations();
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: Theme.charcoal }, headerTintColor: Theme.cream, contentStyle: { backgroundColor: Theme.charcoal } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'SETTINGS', headerBackTitle: '' }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Theme } from '@/constants/Colors';

const tabBarStyle = {
  backgroundColor: Theme.charcoal,
  borderTopColor: Theme.border,
  borderTopWidth: 1,
};

const screenOptions = {
  headerStyle: { backgroundColor: Theme.charcoal },
  headerTintColor: Theme.cream,
  headerTitleStyle: { fontFamily: 'Archivo-SemiBold', letterSpacing: 1 },
  tabBarStyle,
  tabBarActiveTintColor: Theme.rust,
  tabBarInactiveTintColor: Theme.muted,
  tabBarLabelStyle: { fontFamily: 'Archivo-SemiBold', fontSize: 8, letterSpacing: 0.6 },
  tabBarIconStyle: { marginBottom: -2 },
};

const ICON_SIZE = 18;

export default function TabLayout() {
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'BASE',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'mappin.and.ellipse', android: 'place', web: 'place' }} tintColor={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="copilot"
        options={{
          title: 'COPILOT',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} tintColor={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'PLAN',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'map.fill', android: 'map', web: 'map' }} tintColor={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'ACTIVITY',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'figure.hiking', android: 'directions_walk', web: 'directions_walk' }} tintColor={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="sleep"
        options={{
          title: 'SLEEP',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'moon.fill', android: 'bedtime', web: 'bedtime' }} tintColor={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="bath"
        options={{
          title: 'BATH',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} tintColor={color} size={ICON_SIZE} />
          ),
        }}
      />
    </Tabs>
  );
}

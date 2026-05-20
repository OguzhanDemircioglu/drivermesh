import { View } from 'react-native';
import { Stack } from 'expo-router';
import { OfflineBanner } from '@/components/OfflineBanner';
import { theme } from '@/theme';

export default function AppLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: 'slide_from_right',
        }}
      />
      <OfflineBanner />
    </View>
  );
}

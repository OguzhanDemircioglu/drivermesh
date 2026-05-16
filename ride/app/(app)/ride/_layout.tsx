import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function RideLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        animation: 'slide_from_bottom',
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}

import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';

type Props = {
  children: ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
  /** Tam ekran flex children (örn. harita); padding/safe-area uygulanmaz */
  bare?: boolean;
};

export function Screen({ children, edges = ['top', 'bottom'], style, bare = false }: Props) {
  if (bare) {
    return (
      <View style={[styles.bare, style]}>
        <StatusBar style="light" />
        {children}
      </View>
    );
  }
  return (
    <SafeAreaView edges={edges} style={[styles.root, style]}>
      <StatusBar style="light" />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bare: { flex: 1, backgroundColor: colors.bg },
});

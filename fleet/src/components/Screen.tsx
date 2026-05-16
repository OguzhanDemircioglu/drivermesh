import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode } from 'react';
import { MeshBackground } from './MeshBackground';
import { theme } from '@/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showMesh?: boolean;
  /** Root view bg + mesh overlay kapatır — auth ekranlarında RootLayout'un
   *  DRIVERMESH_BG image'inin görünür kalması için. */
  transparent?: boolean;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  contentStyle?: object;
};

export function Screen({
  children,
  scroll = false,
  showMesh = true,
  transparent = false,
  edges = ['top', 'bottom', 'left', 'right'],
  contentStyle,
}: Props) {
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.root, transparent && styles.transparentRoot]}>
      <StatusBar style="light" />
      {showMesh && !transparent ? <MeshBackground /> : null}
      <SafeAreaView style={styles.flex} edges={edges}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <Body
            style={styles.flex}
            contentContainerStyle={
              scroll
                ? [styles.scrollContent, contentStyle]
                : undefined
            }
            keyboardShouldPersistTaps={scroll ? 'handled' : undefined}
          >
            {!scroll ? <View style={[styles.body, contentStyle]}>{children}</View> : children}
          </Body>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  transparentRoot: { backgroundColor: 'transparent' },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: theme.spacing.xl },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
});

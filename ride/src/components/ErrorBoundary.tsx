import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from './Button';
import { colors, spacing } from '@/theme';

type Props = { children: ReactNode };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(error: unknown) {
    // Sentry yok (V1). Lokal log + debug için AsyncStorage'a son crash bırak.
    console.error('[ErrorBoundary]', error);
    AsyncStorage.setItem(
      '@ride:last-crash',
      JSON.stringify({
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    ).catch(() => {});
  }

  reset = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Bir şeyler ters gitti</Text>
        <Text style={styles.body}>
          {this.state.message ?? 'Beklenmeyen bir hata oluştu.'}
        </Text>
        <Button title="Tekrar dene" onPress={this.reset} />
      </View>
    );
  }
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 25, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 17 },
});

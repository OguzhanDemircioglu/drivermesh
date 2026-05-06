import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { Button } from '@/components/Button';
import { theme } from '@/theme';
import { setAppLocale, getAppLocale, type AppLocale } from '@/i18n';

const NODE_COLS = 4;
const NODE_ROWS = 9;
const EMBLEM_SIZE = 196;
const EMBLEM_VERTEX_COUNT = 8;

type NodePos = { x: number; y: number };

export default function WelcomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { width, height } = useWindowDimensions();

  const nodes = useMemo<NodePos[]>(() => {
    const cellW = width / NODE_COLS;
    const cellH = height / (NODE_ROWS + 1);
    const list: NodePos[] = [];
    for (let r = 0; r < NODE_ROWS; r++) {
      for (let c = 0; c < NODE_COLS; c++) {
        const off = (r % 2) * (cellW / 2);
        const seed = r * 13.7 + c * 7.3;
        const jx = Math.sin(seed) * 18;
        const jy = Math.cos(seed * 1.3) * 18;
        list.push({
          x: c * cellW + off + cellW / 2 + jx,
          y: r * cellH + cellH * 0.55 + jy,
        });
      }
    }
    return list;
  }, [width, height]);

  const edges = useMemo<Array<[number, number]>>(() => {
    const result: Array<[number, number]> = [];
    const seen = new Set<string>();
    nodes.forEach((n, i) => {
      const dists = nodes
        .map((other, j) => ({ j, d: Math.hypot(n.x - other.x, n.y - other.y) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      dists.forEach(({ j, d }) => {
        if (d > Math.max(width, height) * 0.28) return;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push([i, j]);
      });
    });
    return result;
  }, [nodes, width, height]);

  const toggleLocale = () => {
    const next: AppLocale = getAppLocale() === 'tr' ? 'en' : 'tr';
    setAppLocale(next);
  };

  const currentLocale = (i18n.language as AppLocale) ?? 'tr';

  return (
    <View style={styles.root}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="welcomeHalo" cx="50%" cy="38%" r="62%">
            <Stop offset="0%" stopColor="#FF7A1A" stopOpacity="0.26" />
            <Stop offset="50%" stopColor="#5B7FFF" stopOpacity="0.16" />
            <Stop offset="100%" stopColor="#0A0E1F" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle
          cx={width / 2}
          cy={height * 0.38}
          r={Math.min(width, height) * 0.7}
          fill="url(#welcomeHalo)"
        />

        {edges.map(([i, j], k) => (
          <Line
            key={`e-${k}`}
            x1={nodes[i].x}
            y1={nodes[i].y}
            x2={nodes[j].x}
            y2={nodes[j].y}
            stroke="#5B7FFF"
            strokeOpacity={0.22}
            strokeWidth={0.9}
          />
        ))}
        {nodes.map((n, i) => (
          <Circle
            key={`n-${i}`}
            cx={n.x}
            cy={n.y}
            r={2.2}
            fill="#E8EEFF"
            opacity={0.85}
          />
        ))}
      </Svg>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={toggleLocale}
            hitSlop={10}
            style={({ pressed }) => [styles.langPill, pressed && { opacity: 0.7 }]}
          >
            <Text
              style={[styles.langText, currentLocale === 'tr' && styles.langTextActive]}
            >
              TR
            </Text>
            <View style={styles.langDot} />
            <Text
              style={[styles.langText, currentLocale === 'en' && styles.langTextActive]}
            >
              EN
            </Text>
          </Pressable>
        </View>

        <View style={styles.heroWrap}>
          <LogoEmblem />
          <Text style={styles.brand}>
            Driver<Text style={styles.brandAccent}>Mesh</Text>
          </Text>
          <Text style={styles.tagline}>{t('auth.welcome.tagline')}</Text>
        </View>

        <View style={styles.ctaWrap}>
          <Button
            title={t('auth.welcome.signIn')}
            onPress={() => router.push('/(auth)/login')}
          />
          <Button
            title={t('auth.welcome.startFleet')}
            variant="secondary"
            onPress={() => router.push('/(auth)/register')}
          />
          <Pressable
            onPress={() => router.push('/(auth)/redeem')}
            hitSlop={10}
            style={({ pressed }) => [styles.inviteRow, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.inviteLink}>{t('auth.welcome.hasInvite')}</Text>
          </Pressable>
          <Text style={styles.footnote}>{t('auth.welcome.footnote')}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function LogoEmblem() {
  const size = EMBLEM_SIZE;
  const r = size / 2;
  const innerR = r - 14;
  const cx = r;
  const cy = r;

  const vertices = useMemo(() => {
    return Array.from({ length: EMBLEM_VERTEX_COUNT }).map((_, i) => {
      const angle = (i / EMBLEM_VERTEX_COUNT) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * innerR, y: cy + Math.sin(angle) * innerR };
    });
  }, [cx, cy, innerR]);

  const ringEdges = useMemo<Array<[number, number]>>(() => {
    return Array.from({ length: EMBLEM_VERTEX_COUNT }).map((_, i) => [
      i,
      (i + 1) % EMBLEM_VERTEX_COUNT,
    ]);
  }, []);

  const diagEdges = useMemo<Array<[number, number]>>(() => {
    return Array.from({ length: EMBLEM_VERTEX_COUNT }).map((_, i) => [
      i,
      (i + 3) % EMBLEM_VERTEX_COUNT,
    ]);
  }, []);

  return (
    <View style={[styles.emblemWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="welcomeEmblemGlow" cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor="#5B7FFF" stopOpacity="0.55" />
            <Stop offset="60%" stopColor="#B89AF0" stopOpacity="0.16" />
            <Stop offset="100%" stopColor="#0A0E1F" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle cx={cx} cy={cy} r={innerR + 10} fill="url(#welcomeEmblemGlow)" />

        {diagEdges.map(([i, j], k) => (
          <Line
            key={`d-${k}`}
            x1={vertices[i].x}
            y1={vertices[i].y}
            x2={vertices[j].x}
            y2={vertices[j].y}
            stroke="#5B7FFF"
            strokeOpacity={0.42}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        ))}
        {ringEdges.map(([i, j], k) => (
          <Line
            key={`r-${k}`}
            x1={vertices[i].x}
            y1={vertices[i].y}
            x2={vertices[j].x}
            y2={vertices[j].y}
            stroke="#5B7FFF"
            strokeOpacity={0.7}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ))}

        {vertices.map((v, k) => (
          <Circle key={`vg-${k}`} cx={v.x} cy={v.y} r={9} fill="#FFFFFF" opacity={0.22} />
        ))}
        {vertices.map((v, k) => (
          <Circle key={`v-${k}`} cx={v.x} cy={v.y} r={4} fill="#FFFFFF" />
        ))}

        <Path
          d={`M ${cx - 24} ${cy - 16} L ${cx} ${cy} L ${cx - 24} ${cy + 16}`}
          stroke="#FF8C3D"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.85}
        />
        <Path
          d={`M ${cx - 6} ${cy - 16} L ${cx + 18} ${cy} L ${cx - 6} ${cy + 16}`}
          stroke="#FF7A1A"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  safe: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: theme.spacing.sm,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(19,24,41,0.55)',
  },
  langText: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.textDim,
    letterSpacing: 1.2,
  },
  langTextActive: {
    color: theme.colors.text,
  },
  langDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.textDim,
  },
  heroWrap: {
    alignItems: 'center',
    gap: theme.spacing.lg,
    marginTop: theme.spacing['3xl'],
  },
  emblemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: theme.font.size['4xl'],
    fontWeight: theme.font.weight.bold,
    color: theme.colors.text,
    letterSpacing: -1,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  brandAccent: { color: theme.colors.lavender },
  tagline: {
    fontSize: theme.font.size.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: theme.spacing.sm,
  },
  ctaWrap: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  inviteRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  inviteLink: {
    color: theme.colors.lavender,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.2,
  },
  footnote: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: theme.spacing.sm,
  },
});

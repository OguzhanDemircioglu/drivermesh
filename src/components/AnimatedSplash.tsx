import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { theme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

type Props = { hint?: string | null };

type NodePos = { x: number; y: number };
type NodeBase = { x: number; y: number; phase: number; speed: number };

const NODE_COLS = 4;
const NODE_ROWS = 8;
const TOUCH_RADIUS = 150;
const TOUCH_PUSH = 42;

export function AnimatedSplash({ hint }: Props) {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2;

  const bases = useMemo<NodeBase[]>(() => {
    const cellW = width / NODE_COLS;
    const cellH = height / (NODE_ROWS + 1);
    const list: NodeBase[] = [];
    for (let r = 0; r < NODE_ROWS; r++) {
      for (let c = 0; c < NODE_COLS; c++) {
        const off = (r % 2) * (cellW / 2);
        const seed = r * 13.7 + c * 7.3;
        const jx = Math.sin(seed) * 18;
        const jy = Math.cos(seed * 1.3) * 18;
        list.push({
          x: c * cellW + off + cellW / 2 + jx,
          y: r * cellH + cellH * 0.6 + jy,
          phase: (r * 1.7 + c * 2.3) % (Math.PI * 2),
          speed: 0.55 + ((r + c) % 3) * 0.18,
        });
      }
    }
    return list;
  }, [width, height]);

  const edges = useMemo<Array<[number, number]>>(() => {
    const result: Array<[number, number]> = [];
    const seen = new Set<string>();
    bases.forEach((n, i) => {
      const dists = bases
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
  }, [bases, width, height]);

  const timer = useSharedValue(0);
  const touchX = useSharedValue(-1000);
  const touchY = useSharedValue(-1000);
  const touchActive = useSharedValue(0);
  const tapPulse = useSharedValue(0);

  useEffect(() => {
    timer.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(timer);
  }, [timer]);

  const positions = useDerivedValue<NodePos[]>(() => {
    const tv = timer.value;
    const tx = touchX.value;
    const ty = touchY.value;
    const ta = touchActive.value;
    return bases.map((b) => {
      const dx = Math.sin(tv * b.speed + b.phase) * 9;
      const dy = Math.cos(tv * b.speed * 0.7 + b.phase) * 9;
      const px = b.x + dx;
      const py = b.y + dy;
      const ddx = px - tx;
      const ddy = py - ty;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      let fx = 0;
      let fy = 0;
      if (d < TOUCH_RADIUS && ta > 0 && d > 0.5) {
        const f = (1 - d / TOUCH_RADIUS) * TOUCH_PUSH * ta;
        fx = (ddx / d) * f;
        fy = (ddy / d) * f;
      }
      return { x: px + fx, y: py + fy };
    });
  });

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      touchX.value = e.x;
      touchY.value = e.y;
      touchActive.value = withTiming(1, { duration: 180 });
      tapPulse.value = 0;
      tapPulse.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) });
    })
    .onUpdate((e) => {
      touchX.value = e.x;
      touchY.value = e.y;
    })
    .onFinalize(() => {
      touchActive.value = withTiming(0, { duration: 700 });
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="55%">
              <Stop offset="0%" stopColor="#FF7A1A" stopOpacity="0.22" />
              <Stop offset="55%" stopColor="#5B7FFF" stopOpacity="0.14" />
              <Stop offset="100%" stopColor="#0A0E1F" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="touchHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FF7A1A" stopOpacity="0.55" />
              <Stop offset="60%" stopColor="#FF7A1A" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#FF7A1A" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="emblemGlow" cx="50%" cy="50%" r="60%">
              <Stop offset="0%" stopColor="#5B7FFF" stopOpacity="0.45" />
              <Stop offset="60%" stopColor="#B89AF0" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#0A0E1F" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          <Circle cx={cx} cy={cy} r={Math.min(width, height) * 0.65} fill="url(#halo)" />

          {edges.map(([i, j], k) => (
            <BgEdge key={`e-${k}`} positions={positions} i={i} j={j} />
          ))}
          {bases.map((_, i) => (
            <BgNode key={`n-${i}`} positions={positions} i={i} />
          ))}

          <TouchHalo touchX={touchX} touchY={touchY} touchActive={touchActive} />
          <TapRipple touchX={touchX} touchY={touchY} progress={tapPulse} />
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <CenterEmblem size={148} />
          <Text style={styles.brand}>
            Driver<Text style={styles.brandAccent}>Mesh</Text>
          </Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      </View>
    </GestureDetector>
  );
}

function BgNode({ positions, i }: { positions: SharedValue<NodePos[]>; i: number }) {
  const props = useAnimatedProps(() => {
    const p = positions.value[i];
    return { cx: p.x, cy: p.y };
  });
  return <AnimatedCircle animatedProps={props} r={2.2} fill="#E8EEFF" opacity={0.85} />;
}

function BgEdge({
  positions,
  i,
  j,
}: {
  positions: SharedValue<NodePos[]>;
  i: number;
  j: number;
}) {
  const props = useAnimatedProps(() => {
    const a = positions.value[i];
    const b = positions.value[j];
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
  return (
    <AnimatedLine
      animatedProps={props}
      stroke="#5B7FFF"
      strokeOpacity={0.22}
      strokeWidth={0.9}
    />
  );
}

function TouchHalo({
  touchX,
  touchY,
  touchActive,
}: {
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  touchActive: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => ({
    cx: touchX.value,
    cy: touchY.value,
    r: 80 + touchActive.value * 30,
    opacity: touchActive.value,
  }));
  return <AnimatedCircle animatedProps={props} fill="url(#touchHalo)" />;
}

function TapRipple({
  touchX,
  touchY,
  progress,
}: {
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  progress: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => {
    const p = progress.value;
    return {
      cx: touchX.value,
      cy: touchY.value,
      r: 30 + p * 180,
      opacity: (1 - p) * 0.6,
    };
  });
  return (
    <AnimatedCircle
      animatedProps={props}
      fill="none"
      stroke="#FF8C3D"
      strokeWidth={1.4}
    />
  );
}

function CenterEmblem({ size }: { size: number }) {
  const r = size / 2;
  const innerR = r - 10;
  const cx = r;
  const cy = r;

  const vertices = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * innerR, y: cy + Math.sin(angle) * innerR };
    });
  }, [cx, cy, innerR]);

  const edges = useMemo<Array<[number, number]>>(() => {
    const list: Array<[number, number]> = [];
    for (let i = 0; i < 8; i++) {
      list.push([i, (i + 1) % 8]);
      list.push([i, (i + 3) % 8]);
    }
    return list;
  }, []);

  const pulse = useSharedValue(1);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(shimmer);
    };
  }, [pulse, shimmer]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, wrapStyle]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="emblemCoreGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#5B7FFF" stopOpacity="0.5" />
            <Stop offset="100%" stopColor="#5B7FFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={innerR + 6} fill="url(#emblemCoreGlow)" />

        {edges.map(([i, j], k) => (
          <Line
            key={`ee-${k}`}
            x1={vertices[i].x}
            y1={vertices[i].y}
            x2={vertices[j].x}
            y2={vertices[j].y}
            stroke="#5B7FFF"
            strokeOpacity={k % 2 === 0 ? 0.7 : 0.45}
            strokeWidth={1.2}
          />
        ))}

        {vertices.map((v, k) => (
          <Circle
            key={`v-glow-${k}`}
            cx={v.x}
            cy={v.y}
            r={7}
            fill="#FFFFFF"
            opacity={0.18}
          />
        ))}
        {vertices.map((v, k) => (
          <Circle key={`v-${k}`} cx={v.x} cy={v.y} r={3.6} fill="#FFFFFF" />
        ))}

        <Path
          d={`M ${cx - 18} ${cy - 12} L ${cx + 2} ${cy} L ${cx - 18} ${cy + 12}`}
          stroke="#FF8C3D"
          strokeOpacity={0.85}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d={`M ${cx - 4} ${cy - 12} L ${cx + 16} ${cy} L ${cx - 4} ${cy + 12}`}
          stroke="#FF7A1A"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  brand: {
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
    color: theme.colors.text,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  brandAccent: { color: theme.colors.lavender },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, marginTop: 4 },
});

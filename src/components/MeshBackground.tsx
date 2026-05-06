import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop, Line, G } from 'react-native-svg';
import { theme } from '@/theme';

const NODES: Array<{ x: number; y: number; r: number }> = [
  { x: 18, y: 22, r: 2.2 },
  { x: 60, y: 14, r: 1.8 },
  { x: 88, y: 32, r: 2.4 },
  { x: 30, y: 48, r: 1.6 },
  { x: 72, y: 56, r: 2.0 },
  { x: 12, y: 78, r: 2.2 },
  { x: 50, y: 80, r: 1.8 },
  { x: 90, y: 72, r: 2.6 },
  { x: 42, y: 30, r: 1.4 },
  { x: 76, y: 88, r: 1.6 },
];

const LINKS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 4],
  [2, 4],
  [3, 5],
  [5, 6],
  [4, 6],
  [6, 7],
  [4, 7],
  [1, 8],
  [8, 4],
  [6, 9],
  [5, 9],
];

export function MeshBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#0A0E1F', '#0E1530', '#0A0E1F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <RadialGradient id="glowOrange" cx="50%" cy="0%" r="60%">
            <Stop offset="0%" stopColor="#FF7A1A" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#FF7A1A" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glowMesh" cx="100%" cy="100%" r="70%">
            <Stop offset="0%" stopColor="#5B7FFF" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#5B7FFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="0" r="60" fill="url(#glowOrange)" />
        <Circle cx="100" cy="100" r="70" fill="url(#glowMesh)" />
        <G opacity={0.45}>
          {LINKS.map(([a, b], i) => {
            const A = NODES[a];
            const B = NODES[b];
            return (
              <Line
                key={`l-${i}`}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke={theme.colors.mesh}
                strokeWidth={0.18}
                strokeOpacity={0.55}
              />
            );
          })}
          {NODES.map((n, i) => (
            <Circle
              key={`n-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.r * 0.18}
              fill={theme.colors.mesh}
              fillOpacity={0.85}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

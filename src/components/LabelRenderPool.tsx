import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { theme } from '@/theme';
import type { LabeledMarkerVariant } from './LabeledMarker';

type VariantSpec = {
  bg: string;
  fg: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const VARIANT: Record<LabeledMarkerVariant, VariantSpec> = {
  hq: { bg: '#0A0E1F', fg: '#FFFFFF', icon: 'garage' },
  'vehicle-active': { bg: theme.colors.success, fg: '#FFFFFF', icon: 'car-side' },
  'vehicle-idle': { bg: '#94A3B8', fg: '#0A0E1F', icon: 'car-side' },
  'vehicle-maintenance': { bg: theme.colors.warning, fg: '#0A0E1F', icon: 'car-side' },
  pickup: { bg: theme.colors.mesh, fg: '#FFFFFF', icon: 'circle-medium' },
  dropoff: { bg: theme.colors.accent, fg: '#FFFFFF', icon: 'flag' },
};

const BASE_ICON_SIZE = 30;
const BASE_FONT_SIZE = 14;
const MIN_SCALE = 0.7;

/**
 * Açık renkli pill background'larında (beyaz, sarı, gümüş gibi) varsayılan
 * beyaz metin okunmaz hale gelir. Bu helper background'ın algılanan
 * parlaklığına bakıp metin/ikon için kontrastlı bir foreground seçer.
 */
function pickContrastingFg(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex);
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // Perceived luminance (Rec. 601 weights) — basit + harita ölçeğinde yeterli.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0A0E1F' : '#FFFFFF';
}

export type LabelSpec = {
  /** Stable identity for memoisation / dedup. */
  key: string;
  variant: LabeledMarkerVariant;
  /** Top line — typically the plate or "Lojistik üssü". */
  label: string;
  /** Middle line — typically the dropoff destination. */
  subline?: string;
  /** Bottom line — typically the elapsed timer ("00:31"). */
  timer?: string;
  /** Compatibility: simple single-line hint when subline/timer are not used. */
  hint?: string;
  scale?: number;
  /** Render the pill at reduced opacity (e.g. when zoomed in so it doesn't
   * obscure pickup/dropoff pins). 0..1, default 1. */
  opacity?: number;
  /** Override the variant's default background colour (used to colour
   * vehicle pills by plate-derived hue instead of status). */
  bgOverride?: string;
};

type Props = {
  items: LabelSpec[];
  onCaptured: (key: string, uri: string) => void;
};

/**
 * Off-screen render pool for marker labels.
 *
 * The pool sits outside the MapView. Each row hosts a ViewShot whose
 * capture() yields a PNG file URI; we forward (key, uri) to the parent
 * so it can pass them to <LabeledMarker imageUri="...">.
 *
 * react-native-view-shot must NOT live inside <Marker> on Android — it
 * triggers a Fabric "view already has a parent" crash. Keeping the pool
 * detached from the map subtree is the canonical workaround.
 */
export function LabelRenderPool({ items, onCaptured }: Props) {
  return (
    <View pointerEvents="none" style={styles.pool}>
      {items.map((spec) => (
        <PoolRow key={spec.key} spec={spec} onCaptured={onCaptured} />
      ))}
    </View>
  );
}

function PoolRow({
  spec,
  onCaptured,
}: {
  spec: LabelSpec;
  onCaptured: (key: string, uri: string) => void;
}) {
  const v = VARIANT[spec.variant];
  const s = Math.max(MIN_SCALE, Math.min(1.5, spec.scale ?? 1));
  const isVehicleVariant = spec.variant.startsWith('vehicle-');
  const isCompact = isVehicleVariant || spec.variant === 'hq';
  // Compact pills (vehicles + HQ) get tiny icon + small text + tight padding
  // — they sit out of the way of pickup/dropoff teardrops.
  const iconSize = Math.round((isCompact ? 18 : BASE_ICON_SIZE) * s);
  const fontSize = Math.round((isCompact ? 10 : BASE_FONT_SIZE) * s);
  const padX = Math.round((isCompact ? 6 : 12) * s);
  const padY = Math.round((isCompact ? 3 : 7) * s);

  const shotRef = useRef<ViewShotRef | null>(null);
  // Re-capture when the inputs change.
  const capture = useCallback(() => {
    const ref = shotRef.current;
    if (!ref?.capture) return;
    ref
      .capture()
      .then((uri: string) => onCaptured(spec.key, uri))
      .catch((e: unknown) => {
        console.warn('[LabelRenderPool] capture failed', spec.key, e);
      });
  }, [onCaptured, spec.key]);

  useEffect(() => {
    // Two RAFs gives Android measurement enough time to settle.
    const id = setTimeout(capture, 120);
    return () => clearTimeout(id);
    // Every visible attribute is a dep — without bgOverride/timer/subline/
    // opacity the pool reused stale PNGs when a vehicle's colour or live
    // counter changed.
  }, [
    capture,
    spec.label,
    spec.hint,
    spec.variant,
    spec.bgOverride,
    spec.timer,
    spec.subline,
    spec.opacity,
    s,
  ]);

  // Vehicle variants: plate on top, timer below. Destination (subline) is
  // intentionally NOT rendered inside the pill — it lives in the job detail
  // / fleet list, not on the map glyph (per the latest brief).
  const isVehicle = isVehicleVariant;
  const opacity = spec.opacity ?? 1;
  const bg = spec.bgOverride ?? v.bg;
  // bgOverride uygulanırken (vehicle pill renk override'ı), açık renk
  // background'da yazılar siyah olsun. Diğer durumlarda variant fg.
  const fg = spec.bgOverride ? pickContrastingFg(spec.bgOverride) : v.fg;
  const showSubline = !isVehicle && spec.subline;
  const showTimer = spec.timer;
  const showHint =
    !isVehicle && !spec.subline && !spec.timer && spec.hint;
  const timerMargin = isCompact ? 0 : 1;
  const minPillWidth = isCompact ? 60 : 110;

  // HQ is rendered as an icon-only chip — no plate/address text on the
  // glyph itself so it stays passive in the visual hierarchy.
  const isHq = spec.variant === 'hq';

  return (
    <ViewShot
      ref={shotRef}
      options={{ format: 'png', quality: 1, result: 'tmpfile' }}
      style={styles.shotWrap}
    >
      <View collapsable={false} style={styles.bubbleWrap}>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: bg,
              paddingHorizontal: isHq ? padY : padX,
              paddingVertical: padY,
              opacity,
              minWidth: isHq ? 0 : minPillWidth,
              borderLeftWidth: 0,
              borderRightWidth: 0,
              borderTopWidth: 0,
              borderBottomWidth: 0,
            },
          ]}
        >
          <MaterialCommunityIcons name={v.icon} size={iconSize} color={fg} />
          {!isHq ? (
            <View style={{ marginLeft: isCompact ? 4 : 6 }}>
              <Text style={[styles.label, { color: fg, fontSize }]} numberOfLines={1}>
                {spec.label}
              </Text>
              {showSubline ? (
                <Text
                  style={[styles.sub, { color: fg, fontSize: fontSize - 2 }]}
                  numberOfLines={1}
                >
                  {spec.subline}
                </Text>
              ) : null}
              {showTimer ? (
                <Text
                  style={[
                    styles.timer,
                    {
                      color: fg,
                      fontSize: isCompact ? fontSize - 1 : fontSize - 2,
                      marginTop: timerMargin,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {spec.timer}
                </Text>
              ) : null}
              {showHint ? (
                <Text
                  style={[styles.sub, { color: fg, fontSize: fontSize - 3 }]}
                  numberOfLines={1}
                >
                  {spec.hint}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.tail,
            {
              borderTopColor: bg,
              borderLeftWidth: Math.round((isCompact ? 5 : 7) * s),
              borderRightWidth: Math.round((isCompact ? 5 : 7) * s),
              borderTopWidth: Math.round((isCompact ? 7 : 9) * s),
              opacity,
            },
          ]}
        />
      </View>
    </ViewShot>
  );
}

export function useLabelRenderPool(items: LabelSpec[]) {
  const [uris, setUris] = useState<Record<string, string>>({});
  const setUri = useCallback((key: string, uri: string) => {
    setUris((prev) => (prev[key] === uri ? prev : { ...prev, [key]: uri }));
  }, []);
  // Drop URIs for keys that no longer exist (vehicle removed, etc.)
  useEffect(() => {
    setUris((prev) => {
      const live = new Set(items.map((i) => i.key));
      const next: Record<string, string> = {};
      let changed = false;
      for (const [k, v] of Object.entries(prev)) {
        if (live.has(k)) next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [items]);
  return { uris, setUri };
}

const styles = StyleSheet.create({
  pool: {
    position: 'absolute',
    left: -10000,
    top: -10000,
    width: 1000,
    height: 1000,
    overflow: 'hidden',
  },
  shotWrap: {
    margin: 4,
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
  },
  bubbleWrap: { alignItems: 'center', backgroundColor: 'transparent' },
  captionWrap: {
    backgroundColor: 'rgba(10,14,31,0.85)',
    borderRadius: 999,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  captionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    // Sides thicker than top/bottom so the rounded ends read as parentheses.
    // Same absolute side thickness across all variants so short and long
    // labels share the same visual frame weight.
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderColor: '#0A0E1F',
    minWidth: 110,
    justifyContent: 'center',
  },
  label: { fontWeight: '800', letterSpacing: 0.2 },
  sub: { fontWeight: '500', marginTop: 1, opacity: 0.85 },
  timer: {
    fontWeight: '700',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});

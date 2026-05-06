import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Marker, type MapMarkerProps } from 'react-native-maps';
import { theme } from '@/theme';

export type MiniPinVariant = 'pickup' | 'dropoff' | 'vehicle';

// Same gradient palette as VehicleCard / vehicles/[id] — keep these in sync
// so the moving pin matches the vehicle's brand colour everywhere.
const VEHICLE_GRADIENTS: Array<readonly [string, string]> = [
  ['#FF8C3D', '#FF7A1A'],
  ['#5B7FFF', '#3D5DDB'],
  ['#B89AF0', '#8C6CD2'],
  ['#22C55E', '#15803D'],
];

export function vehicleColorFromPlate(plate: string | null | undefined): string {
  // Hash the entire plate (not just charCodeAt(0)) — Turkish plates all
  // start with the city code ("34 ...") so a first-char hash collapses
  // every Istanbul vehicle into the same colour. djb2-style hash distributes
  // across the 4-colour gradient palette.
  const p = plate ?? '';
  if (p.length === 0) return VEHICLE_GRADIENTS[0][1];
  let hash = 5381;
  for (let i = 0; i < p.length; i++) {
    hash = ((hash << 5) + hash + p.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % VEHICLE_GRADIENTS.length;
  return VEHICLE_GRADIENTS[idx][1];
}

const PIN_COLOR: Record<MiniPinVariant, string> = {
  pickup: theme.colors.mesh,
  dropoff: theme.colors.accent,
  vehicle: theme.colors.success,
};

const ANCHOR: Record<MiniPinVariant, { x: number; y: number }> = {
  // Custom teardrop tail tip is at the very bottom of the frame —
  // anchor (0.5, 1) plants the pin point on the lat/lng coord.
  pickup: { x: 0.5, y: 1 },
  dropoff: { x: 0.5, y: 1 },
  vehicle: { x: 0.5, y: 0.5 },
};

type Props = Omit<MapMarkerProps, 'children'> & {
  variant: MiniPinVariant;
  /** Override colour (vehicle uses plate-derived hex). */
  color?: string;
  /** Optional address text to render in a small bubble above the pin tip. */
  addressLabel?: string | null;
  /** Vehicle-only: plate text shown in a thin label above the disc. */
  plateLabel?: string | null;
  /** Vehicle-only: timer + destination shown in a tiny line below the plate. */
  captionLabel?: string | null;
};

export function MiniLocationPin({
  variant,
  color,
  addressLabel,
  plateLabel,
  captionLabel,
  ...rest
}: Props) {
  const fill = color ?? PIN_COLOR[variant];

  if (variant === 'vehicle') {
    return (
      <Marker {...rest} anchor={ANCHOR.vehicle}>
        <View collapsable={false} style={styles.vehicleColumn}>
          {plateLabel || captionLabel ? (
            <View style={[styles.vehicleCaption, { borderColor: fill }]}>
              {plateLabel ? (
                <Text style={styles.plateText} numberOfLines={1}>
                  {plateLabel}
                </Text>
              ) : null}
              {captionLabel ? (
                <Text style={styles.captionText} numberOfLines={1}>
                  {captionLabel}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View
            collapsable={false}
            style={[styles.disc, { backgroundColor: fill }]}
          >
            <MaterialCommunityIcons name="car-side" size={14} color="#FFFFFF" />
          </View>
        </View>
      </Marker>
    );
  }

  // pickup/dropoff: classic location-pin shape — solid colour teardrop with
  // a white "hole" cutout in the middle. Compact: the colour + tip carry
  // the meaning, no border or shadow noise.
  void addressLabel;
  // tracksViewChanges initial-true window: Android needs the marker bitmap
  // to rasterize at least once with live updates, then we switch to false
  // for a stable image — that kills the constant re-render flicker that
  // otherwise plagues custom-child markers.
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracking(false), 1500);
    return () => clearTimeout(id);
  }, []);
  return (
    <Marker {...rest} anchor={ANCHOR[variant]} tracksViewChanges={tracking}>
      <View collapsable={false} style={styles.pinFrame}>
        <View style={[styles.pinBubble, { backgroundColor: fill }]}>
          <View style={styles.pinDot} />
        </View>
        <View style={[styles.pinTail, { borderTopColor: fill }]} />
      </View>
    </Marker>
  );
}

// Compact: classic teardrop = filled disc on top, triangular tail at the
// bottom, no border ring. White cutout dot in the middle reads as a hole.
const BUBBLE_SIZE = 22;
const TAIL_HEIGHT = 9;
const TAIL_OVERLAP = 4;

const styles = StyleSheet.create({
  labeledColumn: {
    alignItems: 'center',
    gap: 2,
  },
  addressBubble: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(10,14,31,0.92)',
    borderWidth: 1.5,
    maxWidth: 220,
  },
  addressText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  vehicleColumn: {
    alignItems: 'center',
    gap: 2,
  },
  vehicleCaption: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(10,14,31,0.85)',
    borderWidth: 1,
    maxWidth: 140,
  },
  plateText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  captionText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pinFrame: {
    // Bubble (22) + tail (9) − overlap (4) = 27 tall.
    width: BUBBLE_SIZE + 8, // breathing room for the tail's left/right base
    height: BUBBLE_SIZE + TAIL_HEIGHT - TAIL_OVERLAP,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pinBubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // No outline — colour disc sits clean on the map; the inner white
    // cutout is enough to read the pin shape.
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  pinTail: {
    // Triangle pointing down, formed by a 0×0 box with thick top border.
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: TAIL_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -TAIL_OVERLAP,
  },
  disc: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A0E1F',
  },
});

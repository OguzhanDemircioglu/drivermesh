import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, type Region } from 'react-native-maps';
import { theme } from '@/theme';
import { MiniLocationPin, vehicleColorFromPlate } from './MiniLocationPin';

type LatLng = { lat: number; lng: number };

type Props = {
  pickup: LatLng | null;
  dropoff: LatLng | null;
  /** ISO timestamp; when set, vehicle pin animates pickup→dropoff */
  inProgressStartedAt?: string | null;
  /** Vehicle plate — drives the moving pin colour (matches VehicleCard gradient). */
  vehiclePlate?: string | null;
  height?: number;
};

function regionFor(pickup: LatLng | null, dropoff: LatLng | null): Region | null {
  const points: LatLng[] = [];
  if (pickup) points.push(pickup);
  if (dropoff) points.push(dropoff);
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padLat = Math.max((maxLat - minLat) * 1.6, 0.01);
  const padLng = Math.max((maxLng - minLng) * 1.6, 0.01);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: padLat,
    longitudeDelta: padLng,
  };
}

export function JobMiniMap({
  pickup,
  dropoff,
  inProgressStartedAt,
  vehiclePlate,
  height = 180,
}: Props) {
  const region = useMemo(() => regionFor(pickup, dropoff), [pickup, dropoff]);
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Animated truck position when in_progress.
  // Deps must be primitives — pickup/dropoff are inline-literal props that get
  // a fresh identity on every parent render, which would restart the interval
  // and freeze `t` near 0 (vehicle stuck at pickup).
  const pickupLat = pickup?.lat ?? null;
  const pickupLng = pickup?.lng ?? null;
  const dropoffLat = dropoff?.lat ?? null;
  const dropoffLng = dropoff?.lng ?? null;
  const [animPos, setAnimPos] = useState<LatLng | null>(null);
  const animating =
    !!inProgressStartedAt &&
    pickupLat != null &&
    pickupLng != null &&
    dropoffLat != null &&
    dropoffLng != null;
  useEffect(() => {
    if (
      !animating ||
      pickupLat == null ||
      pickupLng == null ||
      dropoffLat == null ||
      dropoffLng == null
    ) {
      setAnimPos(null);
      return;
    }
    const CYCLE_MS = 28000;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) % CYCLE_MS;
      const t = elapsed / CYCLE_MS;
      setAnimPos({
        lat: pickupLat + (dropoffLat - pickupLat) * t,
        lng: pickupLng + (dropoffLng - pickupLng) * t,
      });
    }, 120);
    return () => clearInterval(id);
  }, [animating, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  // Frame both pins explicitly. Padding on left/right is small so the bbox
  // hugs the horizontal edges; top/bottom bigger so the 42px tall teardrop
  // bitmap doesn't overflow vertically.
  useEffect(() => {
    if (
      !mapReady ||
      pickupLat == null ||
      pickupLng == null ||
      dropoffLat == null ||
      dropoffLng == null
    )
      return;
    mapRef.current?.fitToCoordinates(
      [
        { latitude: pickupLat, longitude: pickupLng },
        { latitude: dropoffLat, longitude: dropoffLng },
      ],
      {
        edgePadding: { top: 44, bottom: 44, left: 28, right: 28 },
        animated: false,
      },
    );
  }, [mapReady, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const vehicleColor = useMemo(
    () => vehicleColorFromPlate(vehiclePlate),
    [vehiclePlate],
  );

  if (!region) return null;

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onMapReady={() => setMapReady(true)}
        toolbarEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {pickup && dropoff ? (
          <Polyline
            coordinates={[
              { latitude: pickup.lat, longitude: pickup.lng },
              { latitude: dropoff.lat, longitude: dropoff.lng },
            ]}
            strokeColor="#F87171"
            strokeWidth={4}
            lineDashPattern={[10, 8]}
            zIndex={1}
          />
        ) : null}
        {pickup ? (
          <MiniLocationPin
            variant="pickup"
            coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
          />
        ) : null}
        {dropoff ? (
          <MiniLocationPin
            variant="dropoff"
            coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
          />
        ) : null}
        {animating && animPos ? (
          <MiniLocationPin
            variant="vehicle"
            color={vehicleColor}
            coordinate={{ latitude: animPos.lat, longitude: animPos.lng }}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});

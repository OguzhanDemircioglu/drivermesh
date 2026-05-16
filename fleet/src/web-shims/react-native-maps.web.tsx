/**
 * react-native-maps web shim.
 *
 * fleet web bundle'ında `react-native-maps` native modülü
 * `codegenNativeComponent is not a function` hatası fırlattığı için metro
 * resolver bu shim'i platform=web altında devreye alır
 * (fleet/metro.config.js).
 *
 * Dummy component'ler harita yerine kompozit bir placeholder render eder;
 * map UI'sı V1 web testinde mevcut değil ama akış (navigation, form, vs.)
 * etkilenmez. Mobile build'lerde shim yüklenmez, gerçek `react-native-maps`
 * kullanılır.
 */
import * as React from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

type LatLng = { latitude: number; longitude: number };

export type Region = LatLng & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapMarkerProps = ViewProps & {
  coordinate?: LatLng;
  title?: string;
  description?: string;
};

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

type MapViewProps = ViewProps & {
  children?: React.ReactNode;
  initialRegion?: Region;
  region?: Region;
};

const MapView = React.forwardRef<View, MapViewProps>(({ children, style, ...rest }, ref) => (
  <View ref={ref} style={[styles.fallback, style]} {...rest}>
    <Text style={styles.label}>Harita web'de devre dışı (V1)</Text>
    {children}
  </View>
));
MapView.displayName = 'MapViewWebShim';

export const Marker: React.FC<MapMarkerProps> = ({ children, style, ...rest }) => (
  <View style={style} {...rest}>
    {children}
  </View>
);

export const Polyline: React.FC<ViewProps> = () => null;
export const Polygon: React.FC<ViewProps> = () => null;
export const Circle: React.FC<ViewProps> = () => null;
export const Callout: React.FC<ViewProps> = ({ children }) => <>{children}</>;

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2348',
    minHeight: 200,
    borderRadius: 12,
  },
  label: { color: '#7a8aff', fontSize: 12, opacity: 0.7 },
});

export default MapView;

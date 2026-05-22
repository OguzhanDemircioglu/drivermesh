import { memo } from 'react';
import { Marker, type MapMarkerProps } from 'react-native-maps';

/**
 * Marker that renders a pre-captured PNG label.
 *
 * The PNG is generated upstream by useLabeledMarkerImage / LabelRenderPool;
 * keeping the bitmap creation outside the MapView avoids a Fabric child-
 * insertion crash that happens when ViewShot is rendered as a Marker child.
 */

export type LabeledMarkerVariant =
  | 'hq'
  | 'vehicle-active'
  | 'vehicle-idle'
  | 'vehicle-maintenance'
  | 'pickup'
  | 'dropoff';

const FALLBACK_PIN: Record<LabeledMarkerVariant, string> = {
  hq: 'navy',
  'vehicle-active': 'green',
  'vehicle-idle': 'gray',
  'vehicle-maintenance': 'yellow',
  pickup: 'blue',
  dropoff: 'orange',
};

type Props = Omit<MapMarkerProps, 'children'> & {
  variant: LabeledMarkerVariant;
  label: string;
  hint?: string;
  /** Pre-captured PNG (file:// URI). When null we fall back to a colored pin. */
  imageUri?: string | null;
};

function LabeledMarkerImpl({
  variant,
  label,
  hint,
  imageUri,
  ...rest
}: Props) {
  // Fabric (new arch) react-native-maps 1.27 bug'ı: undefined geçilen
  // pinColor/image prop'ları native MarkerManager'a null olarak geliyor
  // ve `setPinColor` Integer.intValue() üzerinde NullPointerException
  // atıp UI manager'ı çökertiyor (filo haritasında 8+ marker mount
  // olduğunda app crash → onHostDestroy). prop'u undefined-olarak
  // gönderip "atlanmasını" beklemek yerine koşullu spread ile prop
  // setini iki ayrı moda böl: image-var ise yalnız `image`, yoksa
  // yalnız `pinColor + title/description`.
  const variantProps: Partial<MapMarkerProps> = imageUri
    ? { image: { uri: imageUri } as MapMarkerProps['image'] }
    : { pinColor: FALLBACK_PIN[variant], title: label, description: hint };
  return (
    <Marker
      {...rest}
      anchor={{ x: 0.5, y: 1 }}
      {...variantProps}
      tracksViewChanges={!imageUri}
    />
  );
}

export const LabeledMarker = memo(LabeledMarkerImpl);

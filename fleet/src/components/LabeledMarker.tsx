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
  return (
    <Marker
      {...rest}
      anchor={{ x: 0.5, y: 1 }}
      image={imageUri ? ({ uri: imageUri } as never) : undefined}
      pinColor={imageUri ? undefined : FALLBACK_PIN[variant]}
      title={imageUri ? undefined : label}
      description={imageUri ? undefined : hint}
      tracksViewChanges={!imageUri}
    />
  );
}

export const LabeledMarker = memo(LabeledMarkerImpl);

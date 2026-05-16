import { Image, type ImageStyle, type StyleProp } from 'react-native';

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function Logo({ size = 96, style }: Props) {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={[{ width: size, height: size, borderRadius: size * 0.22 }, style]}
      resizeMode="contain"
    />
  );
}

import { colors } from './colors';

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const;

export const fontSize = {
  xs: 15,
  sm: 16,
  base: 18,
  md: 19,
  lg: 21,
  xl: 25,
  '2xl': 31,
  '3xl': 37,
  '4xl': 45,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  black: '800',
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  fontSize,
  fontWeight,
} as const;

export type Theme = typeof theme;
export { colors };
export type { ColorToken } from './colors';

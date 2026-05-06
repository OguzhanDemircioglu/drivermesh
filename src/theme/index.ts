import { colors } from './colors';

export const theme = {
  colors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 28,
    full: 9999,
  },
  font: {
    size: {
      xs: 12,
      sm: 13,
      base: 15,
      md: 16,
      lg: 18,
      xl: 22,
      '2xl': 28,
      '3xl': 34,
      '4xl': 42,
    },
    weight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      black: '800' as const,
    },
  },
} as const;

export { colors };
export type Theme = typeof theme;

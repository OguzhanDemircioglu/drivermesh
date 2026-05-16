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
    // Boyutlar — orijinal değerlere göre +3px. Üçüncü "biraz daha büyült"
    // adımı. xs:12→15, sm:13→16, base:15→18, md:16→19, lg:18→21, xl:22→25,
    // 2xl:28→31, 3xl:34→37, 4xl:42→45.
    size: {
      xs: 15,
      sm: 16,
      base: 18,
      md: 19,
      lg: 21,
      xl: 25,
      '2xl': 31,
      '3xl': 37,
      '4xl': 45,
    },
    weight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      black: '800' as const,
    },
    // Noto Sans — Google Fonts (SIL OFL), Verdana benzeri ferah karakter.
    // @expo-google-fonts/noto-sans paketinden useFonts ile yükleniyor.
    // Cross-platform tutarlı.
    family: 'NotoSans',
  },
} as const;

export { colors };
export type Theme = typeof theme;

export const colors = {
  bg: '#0A0E1F',
  bgElevated: '#131829',
  surface: '#1A2038',
  surfaceHi: '#222948',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  accent: '#FF7A1A',
  accentHover: '#FF8C3D',
  accentMuted: 'rgba(255,122,26,0.12)',

  mesh: '#5B7FFF',
  meshMuted: 'rgba(91,127,255,0.14)',
  lavender: '#B89AF0',

  text: '#F5F7FA',
  textMuted: '#8A93A6',
  textDim: '#5B6478',

  success: '#22C55E',
  danger: '#EF4444',
  dangerMuted: 'rgba(239,68,68,0.12)',
  warning: '#F59E0B',
} as const;

export type ColorToken = keyof typeof colors;

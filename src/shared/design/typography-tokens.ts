export const fontFamily = {
  sans: "'LINE Seed Sans', 'Noto Sans Thai', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  thai: "'Noto Sans Thai', 'LINE Seed Sans', system-ui, -apple-system, sans-serif",
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 24,
  '2xl': 28,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.65,
  thai: 1.7,
} as const;

export const letterSpacing = {
  normal: '0',
  label: '0.01em',
  button: '0.01em',
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

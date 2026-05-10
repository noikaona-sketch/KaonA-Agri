export const fontFamily = {
  sans: "'LINE Seed Sans', 'Noto Sans Thai', system-ui, -apple-system, sans-serif",
  thai: "'Noto Sans Thai', 'LINE Seed Sans', system-ui, sans-serif",
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 24,
} as const;

export const lineHeight = {
  tight: 1.15,
  normal: 1.45,
  relaxed: 1.65,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

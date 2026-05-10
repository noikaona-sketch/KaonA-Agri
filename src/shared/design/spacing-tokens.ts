export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const touchTarget = {
  min: 44,
  comfortable: 48,
  bottomNav: 58,
} as const;

export const safeArea = {
  top: 'env(safe-area-inset-top)',
  bottom: 'env(safe-area-inset-bottom)',
} as const;

export const brandColors = {
  primary: '#2E7D32',
  primaryPressed: '#1B5E20',
  primarySoft: '#E8F5E9',
  accent: '#F9A825',
  background: '#F7F9F7',
  surface: '#FFFFFF',
  surfaceSoft: '#FAFBFA',
  textPrimary: '#1A1F1C',
  textSecondary: '#4E5A53',
  border: '#D8E0DB',
  success: '#2E7D32',
  warning: '#ED6C02',
  danger: '#D32F2F',
  info: '#0288D1',
} as const;

export const brandRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const brandShadow = {
  sm: '0 4px 14px rgba(15, 23, 42, 0.08)',
  md: '0 8px 30px rgba(15, 23, 42, 0.08)',
  lg: '0 12px 32px rgba(15, 23, 42, 0.14)',
} as const;

export const brandSurface = {
  app: brandColors.background,
  card: brandColors.surface,
  muted: brandColors.surfaceSoft,
  selected: brandColors.primarySoft,
} as const;

export const brandBorder = {
  default: brandColors.border,
  active: brandColors.primary,
  danger: '#FFCDD2',
} as const;

export const statusColors = {
  draft: { bg: '#ECEFF1', fg: '#455A64' },
  submitted: { bg: '#E3F2FD', fg: brandColors.info },
  approved: { bg: brandColors.primarySoft, fg: brandColors.success },
  rejected: { bg: '#FFEBEE', fg: brandColors.danger },
  warning: { bg: '#FFF8E1', fg: brandColors.warning },
} as const;

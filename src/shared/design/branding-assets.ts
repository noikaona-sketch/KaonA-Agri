export const brandingAssets = {
  primary: {
    svg: '/branding/logo-primary.svg',
    png: '/branding/logo-primary.png',
  },
  wordmark: {
    default: '/branding/logo-wordmark.svg',
    dark: '/branding/logo-wordmark-dark.svg',
    white: '/branding/logo-wordmark-white.svg',
  },
  icon: {
    default: '/branding/logo-icon.svg',
    dark: '/branding/logo-icon-dark.svg',
    white: '/branding/logo-icon-white.svg',
  },
  app: {
    splashIcon: '/branding/splash-icon.png',
    favicon: '/branding/favicon.png',
    faviconSvg: '/branding/favicon.svg',
  },
} as const;

export type BrandingAssetKey = keyof typeof brandingAssets;

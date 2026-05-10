export const iconSizes = {
  nav: 28,
  card: 48,
  feature: 64,
  hero: 96,
} as const;

export const strokeWidth = {
  nav: 1.8,
  feature: 2,
  hero: 2.4,
} as const;

export const iconVariants = {
  nav: 'rounded-flat',
  feature: 'soft-contained',
  mono: 'current-color',
} as const;

export const iconPaths = {
  nav: {
    member: '/icons/nav/member.svg',
    service: '/icons/nav/service.svg',
    field: '/icons/nav/field.svg',
    admin: '/icons/nav/admin.svg',
  },
  features: {
    price: '/icons/features/price.svg',
    market: '/icons/features/market.svg',
    trading: '/icons/features/trading.svg',
    memberFarm: '/icons/features/member-farm.svg',
    notification: '/icons/features/notification.svg',
    noBurn: '/icons/features/no-burn.svg',
    tractor: '/icons/features/tractor.svg',
    cornAfterRice: '/icons/features/corn-after-rice.svg',
    soil: '/icons/features/soil.svg',
    recycle: '/icons/features/recycle.svg',
    sustainable: '/icons/features/sustainable.svg',
    booking: '/icons/features/booking.svg',
    seed: '/icons/features/seed.svg',
    gps: '/icons/features/gps.svg',
    camera: '/icons/features/camera.svg',
    reward: '/icons/features/reward.svg',
    inspection: '/icons/features/inspection.svg',
    corn: '/icons/features/corn.svg',
    environment: '/icons/features/environment.svg',
  },
} as const;

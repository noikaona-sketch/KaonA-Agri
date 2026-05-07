const tabs = ['Home', 'Tasks', 'Records', 'Profile'] as const;

type MobileBottomNavProps = {
  activeTab?: (typeof tabs)[number];
};

export function MobileBottomNav({ activeTab = 'Home' }: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={[
            'mobile-bottom-nav__item',
            activeTab === tab ? 'mobile-bottom-nav__item--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-current={activeTab === tab ? 'page' : undefined}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}

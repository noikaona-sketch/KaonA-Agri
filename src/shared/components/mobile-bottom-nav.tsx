const tabs = ['Home', 'Tasks', 'Records', 'Service', 'Profile'] as const;

type MobileBottomNavProps = {
  activeTab?: (typeof tabs)[number];
  onTabChange?: (tab: (typeof tabs)[number]) => void;
};

export function MobileBottomNav({ activeTab = 'Home', onTabChange }: MobileBottomNavProps) {
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
          onClick={onTabChange ? () => onTabChange(tab) : undefined}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}

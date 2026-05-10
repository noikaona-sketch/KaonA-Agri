const tabs = [
  { label: 'Home', icon: '⌂' },
  { label: 'Tasks', icon: '✓' },
  { label: 'Records', icon: '▤' },
  { label: 'Profile', icon: '◉' },
] as const;

type MobileBottomNavProps = {
  activeTab?: (typeof tabs)[number]['label'];
  onTabChange?: (tab: (typeof tabs)[number]['label']) => void;
};

export function MobileBottomNav({ activeTab = 'Home', onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {tabs.map((tab) => (
        <button
          key={tab.label}
          type="button"
          className={[
            'mobile-bottom-nav__item',
            activeTab === tab.label ? 'mobile-bottom-nav__item--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-current={activeTab === tab.label ? 'page' : undefined}
          onClick={onTabChange ? () => onTabChange(tab.label) : undefined}
        >
          <span className="mobile-bottom-nav__icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="mobile-bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

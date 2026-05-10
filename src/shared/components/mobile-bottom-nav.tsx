import Link from 'next/link';

const tabs = ['Home', 'Tasks', 'Records', 'Profile'] as const;

const TAB_LINKS: Record<(typeof tabs)[number], string> = {
  Home: '/',
  Tasks: '/inspection/tasks',
  Records: '/plots',
  Profile: '/profile',
};

type MobileBottomNavProps = {
  activeTab?: (typeof tabs)[number];
  onTabChange?: (tab: (typeof tabs)[number]) => void;
};

export function MobileBottomNav({ activeTab = 'Home', onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {tabs.map((tab) => (
        <Link
          key={tab}
          href={TAB_LINKS[tab]}
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
        </Link>
      ))}
    </nav>
  );
}

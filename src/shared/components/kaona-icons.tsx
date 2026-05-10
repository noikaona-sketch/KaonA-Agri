import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function baseProps(props: IconProps): IconProps {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    ...props,
  };
}

export function MemberNavIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="7.5" r="3.2" />
      <path d="M5.5 18.2c1-3 3.2-4.8 6.5-4.8s5.5 1.8 6.5 4.8" />
    </svg>
  );
}

export function ServiceNavIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="8" cy="16.5" r="2.2" />
      <circle cx="16.5" cy="16.5" r="2.2" />
      <path d="M3.5 14h14l2-4.2h-6.8l-2.1-3.3H7.5" />
    </svg>
  );
}

export function FieldNavIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 20s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="10" r="2.1" />
    </svg>
  );
}

export function AdminNavIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4.5 19.5h15" />
      <path d="M7.2 17V11" />
      <path d="M12 17V7.5" />
      <path d="M16.8 17v-4.2" />
    </svg>
  );
}

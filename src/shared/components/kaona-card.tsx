import type { ReactNode } from 'react';

type KaonaCardVariant = 'feature' | 'info' | 'status' | 'service' | 'summary' | 'kpi' | 'approval' | 'field';

type KaonaCardProps = {
  variant?: KaonaCardVariant;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
};

export function KaonaCard({
  variant = 'info',
  title,
  subtitle,
  icon,
  meta,
  action,
  children,
}: KaonaCardProps) {
  return (
    <section className={`kaona-card kaona-card--${variant}`}>
      {(title || subtitle || icon || meta) ? (
        <header className="kaona-card__header">
          {icon ? <div className="kaona-card__icon" aria-hidden="true">{icon}</div> : null}
          <div className="kaona-card__heading">
            {title ? <h3 className="kaona-card__title">{title}</h3> : null}
            {subtitle ? <p className="kaona-card__subtitle">{subtitle}</p> : null}
          </div>
          {meta ? <div className="kaona-card__meta">{meta}</div> : null}
        </header>
      ) : null}
      {children ? <div className="kaona-card__body">{children}</div> : null}
      {action ? <div className="kaona-card__action">{action}</div> : null}
    </section>
  );
}

export type { KaonaCardProps, KaonaCardVariant };

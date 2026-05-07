import type { ReactNode } from 'react';

type InfoCardProps = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  action?: ReactNode;
};

export function InfoCard({ title, subtitle, meta, action }: InfoCardProps) {
  return (
    <article className="info-card">
      <header className="info-card__header">
        <div>
          <h2 className="info-card__title">{title}</h2>
          {subtitle ? <p className="info-card__subtitle">{subtitle}</p> : null}
        </div>
        {meta ? <div className="info-card__meta">{meta}</div> : null}
      </header>
      {action ? <footer className="info-card__action">{action}</footer> : null}
    </article>
  );
}

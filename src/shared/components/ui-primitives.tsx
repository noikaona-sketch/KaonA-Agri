type UIButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
};

export function UIButton({ children, variant = 'primary' }: UIButtonProps) {
  return <button className={`ui-button ui-button--${variant}`}>{children}</button>;
}

export function StatusChip({ label }: { label: string }) {
  return <span className="status-chip">{label}</span>;
}

export function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="info-card">
      <p className="info-card__title">{title}</p>
      <p className="info-card__value">{value}</p>
    </article>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <header className="section-header">
      <h2>{title}</h2>
      {action}
    </header>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="state-message">{message}</p>;
}

export function LoadingState({ message }: { message: string }) {
  return <p className="state-message">{message}</p>;
}

export function ErrorState({ message }: { message: string }) {
  return <p className="state-message state-message--error">{message}</p>;
}

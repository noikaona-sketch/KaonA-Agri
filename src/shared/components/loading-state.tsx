type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'กำลังโหลด…' }: LoadingStateProps) {
  return (
    <div className="loading-screen" aria-live="polite" aria-label={label}>
      <div style={{ fontSize: 32 }}>🌽</div>
      <div className="loading-screen__dots" aria-hidden="true">
        <span className="loading-screen__dot" />
        <span className="loading-screen__dot" />
        <span className="loading-screen__dot" />
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

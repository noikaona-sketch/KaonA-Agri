type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'Loading' }: LoadingStateProps) {
  return (
    <div className="state-block" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <p className="state-block__title">{label}</p>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  detail?: string;
};

export function EmptyState({ title, detail }: EmptyStateProps) {
  return (
    <div className="state-block state-block--empty">
      <p className="state-block__title">{title}</p>
      {detail ? <p className="state-block__detail">{detail}</p> : null}
    </div>
  );
}

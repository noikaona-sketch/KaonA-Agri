type ErrorStateProps = {
  title: string;
  detail?: string;
};

export function ErrorState({ title, detail }: ErrorStateProps) {
  return (
    <div className="state-block state-block--error" role="alert">
      <p className="state-block__title">{title}</p>
      {detail ? <p className="state-block__detail">{detail}</p> : null}
    </div>
  );
}

type ProgressBadgeProps = {
  current: number;
  total: number;
};

export function ProgressBadge({ current, total }: ProgressBadgeProps) {
  return (
    <span className="progress-badge" aria-label={`Progress ${current} of ${total}`}>
      {current}/{total}
    </span>
  );
}

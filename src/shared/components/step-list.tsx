type Step = { title: string; detail?: string; done?: boolean };

type StepListProps = {
  steps: Step[];
};

export function StepList({ steps }: StepListProps) {
  return (
    <ol className="step-list">
      {steps.map((step, index) => (
        <li key={step.title} className="step-list__item">
          <span className={step.done ? 'step-list__dot step-list__dot--done' : 'step-list__dot'}>{index + 1}</span>
          <div>
            <p className="step-list__title">{step.title}</p>
            {step.detail ? <p className="step-list__detail">{step.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

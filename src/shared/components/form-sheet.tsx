import type { ReactNode } from 'react';

type FormSheetProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function FormSheet({ title, children, footer }: FormSheetProps) {
  return (
    <section className="form-sheet" aria-label={title}>
      <h3 className="form-sheet__title">{title}</h3>
      <div className="form-sheet__body">{children}</div>
      {footer ? <footer className="form-sheet__footer">{footer}</footer> : null}
    </section>
  );
}

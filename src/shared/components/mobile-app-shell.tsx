type MobileAppShellProps = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export function MobileAppShell({ title, subtitle, children }: MobileAppShellProps) {
  return (
    <main className="mobile-shell">
      <section className="mobile-shell__card">
        <p className="mobile-shell__kicker">Admin Dashboard</p>
        <h1 className="mobile-shell__title">{title}</h1>
        {subtitle ? <p className="mobile-shell__subtitle">{subtitle}</p> : null}
        {children ? <div className="mobile-shell__content">{children}</div> : null}
      </section>
    </main>
  );
}

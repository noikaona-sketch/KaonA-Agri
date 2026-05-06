type MobileAppShellProps = {
  title: string;
  subtitle: string;
};

export function MobileAppShell({ title, subtitle }: MobileAppShellProps) {
  return (
    <main className="mobile-shell">
      <section className="mobile-shell__card">
        <p className="mobile-shell__kicker">Mobile-first shell</p>
        <h1 className="mobile-shell__title">{title}</h1>
        <p className="mobile-shell__subtitle">{subtitle}</p>
      </section>
    </main>
  );
}

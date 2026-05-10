interface AppAreaPrototypeProps {
  areaHref: '/member' | '/service' | '/field' | '/admin-prototype';
}

export function AppAreaPrototype({ areaHref }: AppAreaPrototypeProps) {
  return (
    <main>
      <p className="prototype-notice">Prototype area: {areaHref}</p>
      <section className="prototype-kpi-grid">
        <article className="prototype-kpi-card">KPI placeholder</article>
      </section>
      <section className="prototype-workflow-list">
        <article className="prototype-workflow-card">Workflow placeholder</article>
      </section>
      <section className="prototype-action-list">Action placeholder</section>
      <nav className="prototype-area-switcher">Area switcher placeholder</nav>
    </main>
  );
}

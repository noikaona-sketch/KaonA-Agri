type MobileAppShellProps = {
  title: string;
  subtitle: string;
};

export function MobileAppShell({ title, subtitle }: MobileAppShellProps) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '480px',
          borderRadius: '16px',
          background: '#ffffff',
          boxShadow: '0 8px 30px rgba(15, 23, 42, 0.12)',
          padding: '24px',
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#475569' }}>Mobile-first shell</p>
        <h1 style={{ marginBottom: '8px', fontSize: '24px' }}>{title}</h1>
        <p style={{ marginTop: 0, color: '#334155' }}>{subtitle}</p>
      </section>
    </main>
  );
}

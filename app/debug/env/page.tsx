const envChecks = [
  ['NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
  ['NEXT_PUBLIC_LIFF_ID', process.env.NEXT_PUBLIC_LIFF_ID],
] as const;

function yesNo(value: string | undefined) {
  return value && value.trim().length > 0 ? 'yes' : 'no';
}

export default function DebugEnvPage() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ maxWidth: 560, margin: '0 auto', border: '1px solid #ddd', borderRadius: 16, padding: 24 }}>
        <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Safe diagnostics</p>
        <h1 style={{ marginTop: 8, marginBottom: 16, fontSize: 28 }}>Environment presence</h1>
        <div style={{ display: 'grid', gap: 12 }}>
          {envChecks.map(([name, value]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
              <span>{name}</span>
              <strong>{yesNo(value)}</strong>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 20, color: '#666', fontSize: 13 }}>
          This page shows presence only. It does not expose environment values, keys, tokens, or secrets.
        </p>
      </section>
    </main>
  );
}

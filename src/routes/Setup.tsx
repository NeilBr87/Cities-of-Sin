/**
 * Shown when .env.local has not been filled in yet. Better than a stack trace
 * for whoever clones this next.
 */
export default function Setup() {
  return (
    <div className="auth-wrap">
      <div className="auth-box wide">
        <div className="auth-head">
          <div className="brand-mark">Cities of <span>Sin</span></div>
          <p>Not connected to a backend yet.</p>
        </div>

        <div className="card">
          <div className="card-header"><h3>Three steps</h3></div>
          <ol style={{ paddingLeft: 20, lineHeight: 1.9, margin: 0 }}>
            <li>
              Create a project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">supabase.com/dashboard</a>.
            </li>
            <li>
              Copy <code className="mono">.env.example</code> to <code className="mono">.env.local</code> and paste in the
              Project URL and anon key from <span className="dim">Project Settings → API</span>.
            </li>
            <li>
              Push the schema with <code className="mono">npx supabase db push</code>, then restart the dev server.
            </li>
          </ol>
        </div>

        <div className="card">
          <div className="card-header"><h3>Expected in .env.local</h3></div>
          <pre className="mono tiny" style={{ margin: 0, overflowX: 'auto', color: 'var(--ink-dim)' }}>
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>`}
          </pre>
        </div>
      </div>
    </div>
  );
}

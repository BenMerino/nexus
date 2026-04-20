import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SectionHead, Tag } from './ui-primitives';
import { CollaboratorsPanel, type Suggested } from './portfolio-collaborators';

interface Payload { portfolio?: { collaborators: { suggested: Suggested[] } } }

function App() {
  const [suggested, setSuggested] = useState<Suggested[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/dashboard?action=stats')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: Payload) => setSuggested(d.portfolio?.collaborators.suggested || []))
      .catch(e => setErr(String(e)));
  }, []);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <div className="eyebrow">Missing link</div>
          <h1 className="view-title">Suggested <em>collaborators</em>.</h1>
          <div className="view-sub">Researchers in your institution working on similar concepts.</div>
        </div>
        <div className="view-meta"><Tag mono>SCOPED · YOUR ORCID</Tag></div>
      </header>
      <section className="card">
        <SectionHead eyebrow="Concept overlap" title="People you haven't co-authored with" />
        {err && <div className="status error">Error: {err}</div>}
        {!suggested && !err && <div className="muted">Loading…</div>}
        {suggested && <CollaboratorsPanel suggested={suggested} />}
      </section>
    </div>
  );
}

let root: Root | null = null;
function mount() {
  const el = document.getElementById('collaborators-root');
  if (!el) return;
  if (root) root.unmount();
  root = createRoot(el);
  root.render(<App />);
}
(window as any).__nexusMounts = (window as any).__nexusMounts || {};
(window as any).__nexusMounts['/collaborators-bundle.js'] = mount;
mount();

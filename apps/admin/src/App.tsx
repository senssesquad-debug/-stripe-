import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AdminError, ago, auth, call, fmtDate } from './api';

type Page = 'dashboard' | 'review' | 'conflicts' | 'duplicates' | 'reports' | 'reviews' | 'submissions' | 'sources' | 'runs' | 'errors' | 'audit';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function useLoad<T = Any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    call<T>(path).then((d) => alive && (setData(d), setError(null))).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, n, ...deps]);
  return { data, error, reload: useCallback(() => setN((x) => x + 1), []) };
}

let toastSet: (m: string | null) => void = () => undefined;
const toast = (m: string) => { toastSet(m); setTimeout(() => toastSet(null), 2600); };
async function act(fn: () => Promise<unknown>, ok: string, after?: () => void) {
  try {
    await fn();
    toast(ok);
    after?.();
  } catch (e) {
    toast(`Error: ${(e as Error).message}`);
  }
}

const statusBadge = (s: string) => {
  const cls = { confirmed: 'b-ok', success: 'b-ok', likely: 'b-blue', open: 'b-warn', partial: 'b-warn', conflicting: 'b-warn', unverified: '', failed: 'b-bad', cancelled: 'b-bad', skipped: '' }[s] ?? '';
  return <span className={`badge ${cls}`}>{s}</span>;
};

function Table({ head, rows, empty = 'Nothing here.' }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <table>
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

// ── Pages ──────────────────────────────────────────────────────────────────

function Dashboard() {
  const { data, error } = useLoad('/v1/admin/stats');
  if (error) return <p className="muted">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const t = data.totals;
  const max = Math.max(1, ...data.placesByCategory.map((x: Any) => x.n));
  return (
    <>
      <h1>Overview</h1>
      <p className="muted">Data health across sources. Upcoming = not finished, not cancelled.</p>
      <div className="grid">
        {[
          ['Upcoming events', t.upcomingEvents], ['Places', t.places], ['Needs review', t.needsReview], ['Open conflicts', t.openConflicts],
          ['Possible duplicates', t.pendingDuplicates], ['Open reports', t.openReports], ['Pending submissions', t.pendingSubmissions], ['Ingestion errors (24 h)', t.ingestionErrors24h],
        ].map(([k, v]) => <div className="card" key={k as string}><div className="muted small">{k}</div><div className="kpi">{v}</div></div>)}
      </div>
      <h2>Upcoming events by verification</h2>
      <div className="row">{data.eventsByVerification.map((x: Any) => <span key={x.verification_status} className="card">{statusBadge(x.verification_status)} <b>{x.n}</b></span>)}</div>
      <h2>Places by category</h2>
      <div className="card">
        {data.placesByCategory.map((x: Any) => (
          <div key={x.category} className="row" style={{ marginBottom: 6 }}>
            <span style={{ width: 150 }} className="small">{x.category}</span>
            <div className="bar" style={{ width: `${(x.n / max) * 60}%` }} />
            <span className="small muted">{x.n}</span>
          </div>
        ))}
      </div>
      <h2>Integrations</h2>
      <div className="row">{Object.entries(data.integrations).map(([k, v]) => <span key={k} className={`badge ${v ? 'b-ok' : ''}`}>{k}: {v ? 'configured' : 'not configured'}</span>)}</div>
    </>
  );
}

function EntityDrawer({ type, id, onClose }: { type: 'events' | 'places'; id: string; onClose: () => void }) {
  const { data, reload } = useLoad(`/v1/admin/${type}/${id}`);
  const [form, setForm] = useState<Record<string, string>>({});
  if (!data) return <div className="drawer"><p>Loading…</p></div>;
  const e = data.entity;
  const fields = type === 'events' ? ['title', 'starts_at', 'ends_at', 'local_start_date', 'venue_name', 'status', 'ticket_url'] : ['name', 'address', 'phone', 'website', 'status'];
  const save = () => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) if (v !== '') body[k] = v === 'null' ? null : v;
    void act(() => call(`/v1/admin/${type}/${id}`, { method: 'PATCH', body }), 'Saved — locked as moderator value', () => { setForm({}); reload(); });
  };
  return (
    <div className="drawer">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20 }}>{e.title ?? e.name}</h1>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
      <div className="row">{statusBadge(e.verification.status)} <span className="badge">confidence {e.verification.confidence}</span> {e.status ? statusBadge(e.status) : null}</div>
      {e.time ? <p className="muted">{e.time.label} · {e.time.timezone}{e.time.unconfirmed ? ' · time unconfirmed' : ''}</p> : null}
      {e.verification.conflicts.length ? <><h2>Conflicts</h2><pre>{JSON.stringify(e.verification.conflicts, null, 2)}</pre></> : null}
      <h2>Field observations (every value, from every source)</h2>
      <Table head={['Field', 'Value', 'Source', 'Authority', 'Last seen']} rows={data.observations.filter((o: Any) => o.value !== null).map((o: Any) => [<code>{o.field}</code>, <span className="small">{JSON.stringify(o.value).slice(0, 90)}</span>, o.source, o.authority, ago(o.last_seen_at)])} />
      <h2>Source records</h2>
      <Table head={['Source', 'External id', 'Last seen', 'Missing runs']} rows={data.records.map((r: Any) => [r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.source}</a> : r.source, <code>{r.external_id}</code>, ago(r.last_seen_at), r.missing_runs])} />
      <h2>Correct data</h2>
      <p className="small muted">Values entered here override sources until cleared. Use ISO times with offset, e.g. 2026-11-19T20:30:00+02:00. Type <code>null</code> to clear a value.</p>
      {fields.map((f) => (
        <div key={f}><label>{f}</label><input value={form[f] ?? ''} placeholder={String((e as Any)[f === 'starts_at' ? 'time' : f]?.startsAt ?? (e as Any)[f] ?? '')} onChange={(ev) => setForm({ ...form, [f]: ev.target.value })} /></div>
      ))}
      <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={save} disabled={!Object.values(form).some(Boolean)}>Save corrections</button></div>
    </div>
  );
}

function Review({ open }: { open: (t: 'events' | 'places', id: string) => void }) {
  const [status, setStatus] = useState('all');
  const { data } = useLoad(`/v1/admin/review/events?status=${status}`);
  return (
    <>
      <h1>Review queue</h1>
      <p className="muted">Upcoming events that are unverified, conflicting, have an unconfirmed time or only a city-level location.</p>
      <div className="row" style={{ margin: '12px 0' }}>{['all', 'unverified', 'conflicting'].map((s) => <button key={s} className={`btn ${status === s ? '' : 'sec'}`} onClick={() => setStatus(s)}>{s}</button>)}</div>
      <Table head={['Event', 'When', 'Where', 'Status', 'Sources']} rows={(data?.items ?? []).map((e: Any) => [
        <a onClick={() => open('events', e.id)} style={{ cursor: 'pointer' }}>{e.title}</a>, e.time.label, `${e.venue.name ?? '—'} · ${e.location?.precision ?? 'unknown'}`,
        <div className="row">{statusBadge(e.verification.status)}{e.time.unconfirmed ? <span className="badge b-warn">time?</span> : null}</div>, e.verification.sources.map((s: Any) => s.name).join(', '),
      ])} />
    </>
  );
}

function Conflicts({ open }: { open: (t: 'events' | 'places', id: string) => void }) {
  const [status, setStatus] = useState('open');
  const { data, reload } = useLoad(`/v1/admin/conflicts?status=${status}`);
  return (
    <>
      <h1>Conflicts</h1>
      <p className="muted">Sources disagree and none is clearly more authoritative. Nothing is chosen automatically — pick the correct value after checking the organiser.</p>
      <div className="row" style={{ margin: '12px 0' }}>{['open', 'auto_resolved', 'resolved', 'dismissed'].map((s) => <button key={s} className={`btn ${status === s ? '' : 'sec'}`} onClick={() => setStatus(s)}>{s.replace('_', ' ')}</button>)}</div>
      <Table head={['Entity', 'Field', 'Candidates', '']} rows={(data?.items ?? []).map((c: Any) => [
        <a onClick={() => open(c.entity_type === 'event' ? 'events' : 'places', c.entity_id)} style={{ cursor: 'pointer' }}>{c.entity_title}</a>,
        <div><code>{c.field}</code> {c.critical ? <span className="badge b-warn">critical</span> : null}</div>,
        <div style={{ display: 'grid', gap: 6 }}>{c.candidates.map((x: Any, i: number) => (
          <div key={i} className="row"><span className="small"><b>{x.display}</b> — {x.sources.join(', ')}</span>
            {status === 'open' || status === 'auto_resolved' ? <button className="btn sec" onClick={() => act(() => call(`/v1/admin/conflicts/${c.id}/resolve`, { method: 'POST', body: { candidateIndex: i } }), 'Resolved', reload)}>Use this</button> : null}
          </div>
        ))}</div>,
        status === 'open' ? <button className="btn ghost" onClick={() => act(() => call(`/v1/admin/conflicts/${c.id}/dismiss`, { method: 'POST', body: {} }), 'Dismissed', reload)}>Dismiss</button> : null,
      ])} />
    </>
  );
}

function Duplicates() {
  const { data, reload } = useLoad('/v1/admin/duplicates');
  return (
    <>
      <h1>Possible duplicates</h1>
      <p className="muted">Pairs scored between the review and auto-merge thresholds. Merging keeps all sources, saves and reviews; old links redirect.</p>
      <Table head={['Score', 'A', 'B', '']} rows={(data?.items ?? []).map((d: Any) => [
        <span className="badge b-blue">{Math.round(d.score * 100)}%</span>,
        <div><b>{d.a_title}</b><div className="small muted">{d.a_where ?? ''} {d.a_starts_at ? fmtDate(d.a_starts_at) : ''}</div></div>,
        <div><b>{d.b_title}</b><div className="small muted">{d.b_where ?? ''} {d.b_starts_at ? fmtDate(d.b_starts_at) : ''}</div></div>,
        <div className="row">
          <button className="btn sec" onClick={() => act(() => call(`/v1/admin/duplicates/${d.id}/merge`, { method: 'POST', body: { keep: 'a' } }), 'Merged into A', reload)}>Keep A</button>
          <button className="btn sec" onClick={() => act(() => call(`/v1/admin/duplicates/${d.id}/merge`, { method: 'POST', body: { keep: 'b' } }), 'Merged into B', reload)}>Keep B</button>
          <button className="btn ghost" onClick={() => act(() => call(`/v1/admin/duplicates/${d.id}/dismiss`, { method: 'POST', body: {} }), 'Not duplicates', reload)}>Different</button>
        </div>,
      ])} />
    </>
  );
}

function Reports({ open }: { open: (t: 'events' | 'places', id: string) => void }) {
  const { data, reload } = useLoad('/v1/admin/reports');
  return (
    <>
      <h1>User reports</h1>
      <Table head={['Entity', 'Report', 'Message', 'When', '']} rows={(data?.items ?? []).map((r: Any) => [
        <a onClick={() => open(r.entity_type === 'event' ? 'events' : 'places', r.entity_id)} style={{ cursor: 'pointer' }}>{r.entity_title}</a>,
        <div className="row">{statusBadge(r.kind)}{r.same_reports > 1 ? <span className="badge b-warn">×{r.same_reports}</span> : null}</div>, <span className="small">{r.message ?? '—'}</span>, ago(r.created_at),
        <div className="row">
          {['cancelled', 'closed'].includes(r.kind) ? <button className="btn" onClick={() => act(() => call(`/v1/admin/reports/${r.id}/resolve`, { method: 'POST', body: { action: 'accept', apply: true } }), 'Applied', reload)}>Confirm & apply</button> : null}
          <button className="btn sec" onClick={() => act(() => call(`/v1/admin/reports/${r.id}/resolve`, { method: 'POST', body: { action: 'accept' } }), 'Accepted', reload)}>Accept</button>
          <button className="btn ghost" onClick={() => act(() => call(`/v1/admin/reports/${r.id}/resolve`, { method: 'POST', body: { action: 'reject' } }), 'Rejected', reload)}>Reject</button>
        </div>,
      ])} empty="No open reports." />
    </>
  );
}

function Reviews({ open }: { open: (t: 'events' | 'places', id: string) => void }) {
  const [tab, setTab] = useState<'pending' | 'reported' | 'rejected'>('pending');
  const { data, reload } = useLoad(`/v1/admin/reviews?status=${tab}`, [tab]);
  const decide = (id: string, action: 'publish' | 'reject' | 'remove') => act(() => call(`/v1/admin/reviews/${id}`, { method: 'POST', body: { action } }), action === 'publish' ? 'Published' : action === 'reject' ? 'Rejected' : 'Removed', reload);
  return (
    <>
      <h1>Review moderation</h1>
      <p className="muted">Held by automatic moderation (insults, threats, links, ads, duplicates, suspicious accounts) or hidden after reports. Personal data is already masked.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        {(['pending', 'reported', 'rejected'] as const).map((k) => <button key={k} className={`btn ${tab === k ? '' : 'ghost'}`} onClick={() => setTab(k)}>{k}</button>)}
      </div>
      <Table head={['Review', 'About', 'Why', 'Author', 'When', '']} rows={(data?.items ?? []).map((r: Any) => [
        <div><b>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</b><div className="small" style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{r.body ?? '—'}</div></div>,
        <a onClick={() => open(r.entity_type === 'event' ? 'events' : 'places', r.entity_id)} style={{ cursor: 'pointer' }}>{r.entity_title}</a>,
        <div className="small">{(r.moderation?.labels ?? []).map((l: string) => <span key={l} className="badge b-warn" style={{ marginRight: 4 }}>{l}</span>)}{(r.moderation?.reasons ?? []).join('; ')}{(r.reports ?? []).map((x: Any, i: number) => <div key={i}>report: {x.reason}{x.message ? ` — ${x.message}` : ''}</div>)}</div>,
        <span className="small">{r.author_name ?? '—'}<br />{r.author_email}</span>, ago(r.created_at),
        <div className="row">
          <button className="btn" onClick={() => decide(r.id, 'publish')}>Publish</button>
          <button className="btn ghost" onClick={() => decide(r.id, tab === 'reported' ? 'remove' : 'reject')}>{tab === 'reported' ? 'Remove' : 'Reject'}</button>
        </div>,
      ])} empty="Nothing to moderate." />
    </>
  );
}

function Submissions() {
  const { data, reload } = useLoad('/v1/admin/submissions');
  return (
    <>
      <h1>Organiser submissions</h1>
      <p className="muted">Events appear only after approval; approved events are marked organiser-confirmed.</p>
      <Table head={['Event', 'When', 'Where', 'Contact', '']} rows={(data?.items ?? []).map((s: Any) => [
        <div><b>{s.payload.title}</b><div className="small muted">{s.payload.category} · {s.payload.organizer}</div></div>,
        `${s.payload.startDate} ${s.payload.startTime ?? '(no time)'}`, `${s.payload.venueName}, ${s.payload.city}`, <span className="small">{s.contact}</span>,
        <div className="row">
          <button className="btn" onClick={() => act(() => call(`/v1/admin/submissions/${s.id}/approve`, { method: 'POST', body: {} }), 'Approved and published', reload)}>Approve</button>
          <button className="btn ghost" onClick={() => act(() => call(`/v1/admin/submissions/${s.id}/reject`, { method: 'POST', body: {} }), 'Rejected', reload)}>Reject</button>
        </div>,
      ])} empty="No pending submissions." />
    </>
  );
}

function Sources() {
  const { data, reload } = useLoad('/v1/admin/sources');
  return (
    <>
      <h1>Sources</h1>
      <p className="muted">Website sources (JSON-LD/iCal) cannot be enabled until their terms of use are reviewed. Intervals adapt between min and max.</p>
      <Table head={['Source', 'Connector', 'Authority', 'Interval', 'Last run', 'Records', '']} rows={(data?.items ?? []).filter((s: Any) => s.connector !== 'manual').map((s: Any) => [
        <div><b>{s.name}</b><div className="small muted">{s.key}{s.requires_key ? <> · needs <code>{s.requires_key}</code> {s.keyConfigured ? <span className="badge b-ok">set</span> : <span className="badge b-bad">missing</span>}</> : null}</div>
          {s.terms_notes ? <div className="small muted" style={{ maxWidth: 380 }}>{s.terms_notes}</div> : null}</div>,
        <code>{s.connector}</code>, s.authority,
        <span className="small">{Math.round(s.current_interval_s / 60)} min<br /><span className="muted">{Math.round(s.min_interval_s / 60)}–{Math.round(s.max_interval_s / 60)} · next {fmtDate(s.next_run_at)}</span></span>,
        s.last_run ? <div className="small">{statusBadge(s.last_run.status)} {ago(s.last_run.started_at)}<div className="muted">+{s.last_run.created} ~{s.last_run.updated} ={s.last_run.unchanged} ⇄{s.last_run.merged} !{s.last_run.errors}</div>{s.last_run.error_message ? <div style={{ color: 'var(--danger)' }}>{s.last_run.error_message}</div> : null}</div> : '—',
        s.records,
        <div className="row">
          <button className={`btn ${s.enabled ? 'sec' : ''}`} onClick={() => act(() => call(`/v1/admin/sources/${s.id}`, { method: 'PATCH', body: { enabled: !s.enabled } }), s.enabled ? 'Disabled' : 'Enabled', reload)}>{s.enabled ? 'Disable' : 'Enable'}</button>
          <button className="btn sec" disabled={!s.enabled} onClick={() => act(() => call(`/v1/admin/sources/${s.id}/run`, { method: 'POST', body: {} }), 'Run started', reload)}>Run now</button>
          {!s.terms_reviewed_at ? <button className="btn ghost" onClick={() => act(() => call(`/v1/admin/sources/${s.id}`, { method: 'PATCH', body: { termsReviewed: true } }), 'Terms review recorded', reload)}>Mark terms reviewed</button> : <span className="badge b-ok">terms ok</span>}
        </div>,
      ])} />
    </>
  );
}

function Runs() {
  const { data } = useLoad('/v1/admin/runs?limit=100');
  return (
    <>
      <h1>Ingestion runs</h1>
      <Table head={['Source', 'Started', 'Duration', 'Status', 'Fetched', 'New', 'Updated', 'Same', 'Merged', 'Hidden', 'Errors']} rows={(data?.items ?? []).map((r: Any) => [
        r.source_name, fmtDate(r.started_at), r.finished_at ? `${Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)} s` : '…', statusBadge(r.status), r.fetched, r.created, r.updated, r.unchanged, r.merged, r.missing, r.errors,
      ])} />
    </>
  );
}

function Errors() {
  const { data } = useLoad('/v1/admin/errors?limit=100');
  return <><h1>Integration errors</h1><Table head={['When', 'Source', 'Stage', 'Record', 'Message']} rows={(data?.items ?? []).map((e: Any) => [ago(e.created_at), e.source_key, <code>{e.stage}</code>, <code>{e.external_id ?? '—'}</code>, <span className="small">{e.message}</span>])} empty="No errors." /></>;
}

function Audit() {
  const { data } = useLoad('/v1/admin/audit?limit=100');
  return <><h1>Audit log</h1><Table head={['When', 'Actor', 'Action', 'Entity']} rows={(data?.items ?? []).map((a: Any) => [fmtDate(a.created_at), <code>{a.actor_id.slice(0, 8)}</code>, a.action, <code>{a.entity_type ?? ''} {a.entity_id?.slice(0, 8) ?? ''}</code>])} /></>;
}

// ── Shell ──────────────────────────────────────────────────────────────────

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tryToken = async (t: string) => {
    auth.set(t);
    try {
      await call('/v1/admin/stats');
      onDone();
    } catch (e) {
      const me = await call<{ id: string; email: string | null }>('/v1/me').catch(() => null);
      auth.clear();
      setErr(e instanceof AdminError && e.status === 403
        ? `Signed in as ${me?.email ?? 'this account'}, which is not an admin. Add its user id ${me?.id ?? ''} to ADMIN_USER_IDS, or its confirmed e-mail to ADMIN_EMAILS, on the server.`
        : (e as Error).message);
    }
  };
  return (
    <div style={{ maxWidth: 440, margin: '12vh auto', padding: 24 }} className="card">
      <div className="brand"><span className="logo"><img src="/admin/favicon.png" width={30} height={30} alt="" /></span>passtra admin</div>
      <p className="muted small">Sign in with your passtra account. Admin rights come from ADMIN_USER_IDS or a confirmed e-mail in ADMIN_EMAILS.</p>
      <label>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value.trim())} autoComplete="username" />
      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      {advanced ? (<><label>Access token</label><textarea rows={3} value={token} onChange={(e) => setToken(e.target.value.trim())} /></>) : null}
      {err ? <p style={{ color: 'var(--danger)' }}>{err}</p> : null}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={async () => {
          setErr(null);
          if (advanced && token) return tryToken(token);
          try {
            const r = await fetch('/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
            const j = await r.json();
            if (!r.ok) { setErr(j?.error?.message ?? 'Sign-in failed'); return; }
            await tryToken(j.token);
          } catch (e) {
            setErr((e as Error).message);
          }
        }}>Sign in</button>
        <button className="btn ghost" onClick={() => setAdvanced(!advanced)}>{advanced ? 'Use email' : 'Use a token'}</button>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!auth.get());
  const [page, setPage] = useState<Page>('dashboard');
  const [drawer, setDrawer] = useState<{ type: 'events' | 'places'; id: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  toastSet = setMsg;
  const stats = useLoad(authed ? '/v1/admin/stats' : null, [page]);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const t = stats.data?.totals ?? {};
  const nav: Array<[Page, string, number?]> = [
    ['dashboard', 'Overview'], ['review', 'Review queue', t.needsReview], ['conflicts', 'Conflicts', t.openConflicts], ['duplicates', 'Duplicates', t.pendingDuplicates],
    ['reports', 'Reports', t.openReports], ['reviews', 'Reviews', t.pendingReviews], ['submissions', 'Submissions', t.pendingSubmissions], ['sources', 'Sources'], ['runs', 'Runs'], ['errors', 'Errors', t.ingestionErrors24h], ['audit', 'Audit log'],
  ];
  const open = (type: 'events' | 'places', id: string) => setDrawer({ type, id });
  return (
    <div className="layout">
      <aside className="side">
        <div className="brand"><span className="logo"><img src="/admin/favicon.png" width={30} height={30} alt="" /></span>passtra</div>
        {nav.map(([k, label, count]) => (
          <button key={k} className={`nav ${page === k ? 'on' : ''}`} onClick={() => setPage(k)}>{label}{count ? <span className="count">{count}</span> : null}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="nav" onClick={() => { auth.clear(); setAuthed(false); }}>Sign out</button>
      </aside>
      <main>
        {page === 'dashboard' && <Dashboard />}
        {page === 'review' && <Review open={open} />}
        {page === 'conflicts' && <Conflicts open={open} />}
        {page === 'duplicates' && <Duplicates />}
        {page === 'reports' && <Reports open={open} />}
        {page === 'reviews' && <Reviews open={open} />}
        {page === 'submissions' && <Submissions />}
        {page === 'sources' && <Sources />}
        {page === 'runs' && <Runs />}
        {page === 'errors' && <Errors />}
        {page === 'audit' && <Audit />}
      </main>
      {drawer ? <EntityDrawer {...drawer} onClose={() => setDrawer(null)} /> : null}
      {msg ? <div className="toast">{msg}</div> : null}
    </div>
  );
}

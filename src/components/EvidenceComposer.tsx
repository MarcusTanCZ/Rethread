// Signal entry: the six one click samples, and a form to paste or edit a signal before running the agent.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileText, Mail, Newspaper, Gauge, Landmark, NotebookPen, Play, type LucideIcon } from 'lucide-react';
import type { EvidenceDraft, EvidenceSource } from '../types';
import { SAMPLE_SIGNALS } from '../data/samples';
import { formatDate } from '../lib/format';
import { SOURCE_LABEL } from '../lib/describe';
import { today } from '../lib/clock';

const SOURCE_ICON: Record<EvidenceSource, LucideIcon> = {
  email: Mail, 'meeting-note': NotebookPen, metric: Gauge, regulatory: Landmark, news: Newspaper, manual: FileText,
};

const MIN_BODY = 20;
/** Keeps pathological pastes from slowing the engine; far above any real signal. */
const MAX_BODY = 20_000;

export function EvidenceComposer({ onRun, busy, runLabel = 'Run agent', preloadKey, onPreloaded }: {
  onRun: (d: EvidenceDraft) => void;
  busy: boolean;
  runLabel?: string;
  /** A sample to load on arrival, then focus Run so Enter starts the agent. */
  preloadKey?: string | null;
  onPreloaded?: () => void;
}) {
  const runRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<EvidenceSource>('email');
  const [receivedOn, setReceivedOn] = useState(today());
  const [body, setBody] = useState('');

  const load = (key: string) => {
    const s = SAMPLE_SIGNALS.find((x) => x.key === key)!;
    setSelected(key);
    setTitle(s.title);
    setSource(s.source);
    setReceivedOn(s.receivedOn);
    setBody(s.body);
  };

  useEffect(() => {
    if (!preloadKey || !SAMPLE_SIGNALS.some((s) => s.key === preloadKey)) return;
    load(preloadKey);
    onPreloaded?.();
    // Focus after the state update renders the button enabled.
    window.setTimeout(() => runRef.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadKey]);

  const ready = body.trim().length >= MIN_BODY && !busy;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    onRun({ title: title.trim() || 'Untitled signal', source, receivedOn: receivedOn || today(), body });
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <section className="card">
        <header className="card-header py-2">
          <h2 className="card-title">Sample signals</h2>
          <span className="ml-auto text-[11px] text-slate-500">Click to load</span>
        </header>
        <ul className="divide-y divide-slate-100">
          {SAMPLE_SIGNALS.map((s) => {
            const Icon = SOURCE_ICON[s.source];
            const on = selected === s.key;
            return (
              <li key={s.key}>
                <button type="button" onClick={() => load(s.key)} disabled={busy} aria-pressed={on}
                  className={`relative flex w-full items-center gap-2.5 px-3.5 py-[7px] text-left transition-colors disabled:opacity-60 ${
                    on ? 'bg-accent-50' : 'hover:bg-slate-50'}`}>
                  {on && <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-accent-600" aria-hidden />}
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${on ? 'text-accent-600' : 'text-slate-400'}`} aria-hidden />
                  <span className={`min-w-0 flex-1 truncate ${on ? 'font-medium text-slate-900' : 'text-slate-700'}`}>{s.label}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{SOURCE_LABEL[s.source]}, {formatDate(s.receivedOn).replace(/ \d{4}$/, '')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <form onSubmit={submit} className="card flex min-h-0 flex-1 flex-col gap-2.5 p-3.5">
        <div>
          <label htmlFor="sig-title" className="label">Title</label>
          <input id="sig-title" className="field h-8" value={title} onChange={(e) => { setTitle(e.target.value); setSelected(null); }}
            placeholder="What is this signal?" disabled={busy} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="sig-source" className="label">Source</label>
            <select id="sig-source" className="field h-8" value={source} onChange={(e) => setSource(e.target.value as EvidenceSource)} disabled={busy}>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sig-date" className="label">Received</label>
            <input id="sig-date" type="date" className="field h-8" value={receivedOn} max={today()} onChange={(e) => setReceivedOn(e.target.value)} disabled={busy} />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <label htmlFor="sig-body" className="label">Signal text</label>
          <textarea id="sig-body" className="field min-h-[120px] flex-1 resize-none py-2 leading-[1.5]" value={body}
            onChange={(e) => { setBody(e.target.value.slice(0, MAX_BODY)); setSelected(null); }} disabled={busy} maxLength={MAX_BODY}
            placeholder="Paste an email, meeting note, metric report or notice." />
        </div>
        <div className="flex items-center gap-3">
          <button ref={runRef} type="submit" className="btn-primary" disabled={!ready}>
            <Play className="h-3.5 w-3.5" aria-hidden /> {busy ? 'Agent running' : runLabel}
          </button>
          <span className="text-[11px] text-slate-500">
            {body.trim().length < MIN_BODY ? `Needs at least ${MIN_BODY} characters of text` : `${body.trim().length} characters`}
          </span>
        </div>
      </form>
    </div>
  );
}

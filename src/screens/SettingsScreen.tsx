// Settings and admin: engine toggle, LLM key with warning banner, confidence thresholds, seeded users, storage status and Reset demo.
import type { ReactNode } from 'react';
import { AlertTriangle, Cpu, Database, KeyRound, Play, Presentation, RotateCcw, Sparkles } from 'lucide-react';
import type { EngineKind } from '../types';
import { ROLE_LABEL } from '../components/roleLabels';
import { useToast } from '../components/Toast';
import { formatConfidence } from '../lib/format';
import { browserStorage } from '../state/persistence';
import { visibleDecisions } from '../state/selectors';
import { useStore } from '../state/store';

function Card({ title, icon, children, aside }: { title: string; icon: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card">
      <header className="card-header">
        <span className="text-slate-500">{icon}</span>
        <h2 className="card-title">{title}</h2>
        {aside && <span className="ml-auto">{aside}</span>}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function Slider({ id, label, hint, value, min, max, step, display, onChange }: {
  id: string; label: string; hint: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_180px_56px] items-center gap-3 py-1.5">
      <label htmlFor={id} className="min-w-0">
        <div className="font-medium text-slate-800">{label}</div>
        <div className="text-[11.5px] text-slate-500">{hint}</div>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-accent-600" />
      <span className="text-right font-mono text-[12.5px] text-slate-900">{display}</span>
    </div>
  );
}

export default function SettingsScreen() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { settings } = state;
  const storageOk = browserStorage() !== null;


  const setEngine = (engine: EngineKind) => dispatch({ type: 'settings/update', patch: { engine } });
  const setLlm = (patch: Partial<typeof settings.llm>) => dispatch({ type: 'settings/update', patch: { llm: patch } });
  const setT = (patch: Partial<typeof settings.thresholds>) => dispatch({ type: 'settings/update', patch: { thresholds: patch } });

  // Instant and idempotent: rebuilding the seed is cheap and pressing it twice changes nothing.
  const reset = () => {
    dispatch({ type: 'reset' });
    toast('success', 'Demo reset to the seeded Calder Group scenario.');
  };
  const hero = () => {
    dispatch({ type: 'demo/loadHero' });
    toast('success', 'Hero scenario loaded. Press Enter to run the agent.');
  };

  const engines: { kind: EngineKind; title: string; body: string; icon: ReactNode }[] = [
    { kind: 'local', title: 'Local engine', body: 'Default. Runs offline in this browser and gives the same answer every time.', icon: <Cpu className="h-4 w-4" /> },
    { kind: 'llm', title: 'LLM engine', body: 'Optional. Calls a chat completions endpoint; falls back to the local engine on any error.', icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
      <div className="space-y-3">
        <Card title="Reasoning engine" icon={<Cpu className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Engine">
            {engines.map((e) => {
              const on = settings.engine === e.kind;
              return (
                <button key={e.kind} type="button" role="radio" aria-checked={on} onClick={() => setEngine(e.kind)}
                  className={`rounded-md border px-3 py-2.5 text-left transition-colors ${on ? 'border-accent-600 bg-accent-50 ring-1 ring-accent-600' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className={`flex items-center gap-2 font-medium ${on ? 'text-accent-700' : 'text-slate-800'}`}>{e.icon}{e.title}</div>
                  <p className="mt-0.5 text-[12px] text-slate-500">{e.body}</p>
                </button>
              );
            })}
          </div>

          {settings.engine === 'llm' && (
            <div className="mt-3 space-y-2.5">
              <div role="alert" className="flex gap-2.5 rounded border border-slate-300 border-l-4 border-l-slate-900 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-slate-900" aria-hidden />
                <span><span className="font-semibold text-slate-900">The key lives in this browser.</span> It is stored in localStorage on this machine only and is sent to the endpoint below. Never commit it, paste it into a shared file or use a production key for a demo.</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <label htmlFor="llm-endpoint" className="label">Chat completions endpoint</label>
                  <input id="llm-endpoint" className="field h-8" value={settings.llm.endpoint} placeholder="https://api.example.com/v1/chat/completions"
                    onChange={(e) => setLlm({ endpoint: e.target.value })} spellCheck={false} />
                </div>
                <div>
                  <label htmlFor="llm-model" className="label">Model</label>
                  <input id="llm-model" className="field h-8" value={settings.llm.model} placeholder="model name" onChange={(e) => setLlm({ model: e.target.value })} spellCheck={false} />
                </div>
                <div>
                  <label htmlFor="llm-key" className="label">API key</label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" aria-hidden />
                    <input id="llm-key" type="password" autoComplete="off" className="field h-8 pl-8" value={settings.llm.apiKey}
                      onChange={(e) => setLlm({ apiKey: e.target.value })} placeholder="not set" />
                  </div>
                </div>
              </div>
              <p className="text-[11.5px] text-slate-500">If the call fails, times out after {settings.llm.timeoutMs / 1000} s or returns anything that does not match the schema, the local engine takes over and a notice appears.</p>
            </div>
          )}
        </Card>

        <Card title="Confidence thresholds" icon={<Sparkles className="h-4 w-4" />}>
          <Slider id="t-broken" label="Broken at" hint="A contradicting finding at or above this marks the assumption broken"
            value={settings.thresholds.broken} min={0.5} max={0.95} step={0.01} display={formatConfidence(settings.thresholds.broken)}
            onChange={(v) => setT({ broken: Math.max(v, settings.thresholds.shaky + 0.05) })} />
          <Slider id="t-shaky" label="Shaky at" hint="Below broken but at or above this marks it shaky; weaker findings are ignored"
            value={settings.thresholds.shaky} min={0.2} max={0.7} step={0.01} display={formatConfidence(settings.thresholds.shaky)}
            onChange={(v) => setT({ shaky: Math.min(v, settings.thresholds.broken - 0.05) })} />
          <Slider id="t-margin" label="Near limit margin" hint="A figure that passes but is this close to its limit counts as shaky"
            value={settings.thresholds.shakyMargin} min={0.01} max={0.1} step={0.005} display={`${(settings.thresholds.shakyMargin * 100).toFixed(1)}%`}
            onChange={(v) => setT({ shakyMargin: v })} />
          <Slider id="t-step" label="Trace step delay" hint="Pause between agent trace steps in the signal inbox"
            value={settings.traceStepMs} min={150} max={1500} step={50} display={`${settings.traceStepMs} ms`}
            onChange={(v) => dispatch({ type: 'settings/update', patch: { traceStepMs: v } })} />
        </Card>
      </div>

      <div className="space-y-3">
        <Card title="Demo" icon={<Presentation className="h-4 w-4" />}>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <button type="button" onClick={hero} className="btn-primary h-8 w-44 shrink-0 whitespace-nowrap">
                <Play className="h-3.5 w-3.5" aria-hidden /> Run hero scenario
              </button>
              <span className="min-w-0 text-[12px] text-slate-600">Resets to the seed and opens the Signal inbox with the FrostLink notice loaded. Press Enter to run.</span>
              <kbd className="ml-auto shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 font-mono text-[11px] text-slate-600">D</kbd>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={reset} className="btn-quiet h-8 w-44 shrink-0 whitespace-nowrap">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset demo
              </button>
              <span className="min-w-0 text-[12px] text-slate-600">Restores the seeded scenario exactly, instantly. You stay signed in; any LLM key is kept.</span>
              <kbd className="ml-auto shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 font-mono text-[11px] text-slate-600">R</kbd>
            </div>
            <p className="border-t border-slate-100 pt-2 text-[11.5px] text-slate-500">
              Shortcuts work on the login screen and for this executive account, and are ignored while typing in a field. They are presenter controls, not a security boundary: the data lives in this browser.
            </p>
          </div>
        </Card>

        <Card title="Seeded users" icon={<KeyRound className="h-4 w-4" />} aside={<span className="text-[11.5px] text-slate-500">Password demo1234 for all</span>}>
          <table className="-mx-1 w-[calc(100%+0.5rem)] text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th px-1">User</th>
                <th className="th">Username</th>
                <th className="th">Role</th>
                <th className="th px-1 text-right">Sees</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(state.users).map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="td px-1">
                    <div className="font-medium text-slate-900">{u.name}</div>
                    <div className="text-[11.5px] text-slate-500">{u.title}</div>
                  </td>
                  <td className="td font-mono text-[12px]">{u.username}</td>
                  <td className="td">{ROLE_LABEL[u.role]}</td>
                  <td className="td px-1 text-right tabular-nums">{visibleDecisions(state, u).length} decisions</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Demo data" icon={<Database className="h-4 w-4" />}>
          <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-y-1 text-[12.5px]">
            <dt className="text-slate-500">Storage</dt>
            <dd className="text-slate-800">{storageOk ? 'Saved in this browser (localStorage)' : 'Unavailable here; changes last until the tab closes'}</dd>
            <dt className="text-slate-500">Contents</dt>
            <dd className="text-slate-800">
              {Object.keys(state.decisions).length} decisions, {Object.keys(state.assumptions).length} assumptions, {Object.keys(state.evidence).length} evidence items, {Object.keys(state.briefs).length} brief{Object.keys(state.briefs).length === 1 ? '' : 's'}
            </dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}

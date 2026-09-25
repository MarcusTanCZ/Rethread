# Rethread

A decision system of record that watches the assumptions underneath past decisions. When new
evidence contradicts one, an agent reopens the decision, drafts a reopen brief, and brings back
the options that were rejected at the time, together with the reason they were rejected.

Hackathon prototype for Calder Group, a fictional regional food distributor. It runs entirely in
the browser, needs no server and makes no network requests in its default mode.

## Open it

**No install, no internet:** double click `docs/index.html`. It is a single self contained file
(about 365 KB) and works straight from the file system. Data is saved in the browser's
localStorage.

**Publishing on Manus:** use the prompt in [MANUS_PROMPT.md](MANUS_PROMPT.md). It tells the agent to
serve the built file unchanged and gives it a 12 point checklist to verify the live site.

**For development:**

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run check:seed   # seed consistency report
npm run build        # rebuilds docs/index.html
```

Requires Node 20 or later.

## Logins

| Username | Password | Name | Role | Sees |
|---|---|---|---|---|
| `ceo` | `demo1234` | Priya Raman | Executive | All 12 decisions with values, portfolio, signal inbox, settings and admin |
| `jlim` | `demo1234` | Joanne Lim | Decision owner (logistics) | Her 6 decisions with values, her reopen tasks, signal inbox |
| `dtan` | `demo1234` | Daniel Tan | Contributor (operations) | Submit evidence, and a read only view of the 4 decisions he is a stakeholder on, never values |

The second login step asks for a 6 digit code. The current code is shown in the dashed
**Demo mode** box on that screen; **Use code** fills it in. Three wrong attempts, on either
step, lock sign in for 10 seconds.

Role access is enforced in one selector, `visibleDecisions(user)` in
`src/state/selectors.ts`, which every screen reads through. A contributor's decisions arrive
with the value already removed, so no screen can show it by mistake.

## Demo script (about 70 seconds with narration)

Start from a clean state: sign in as `ceo` and press **R**, or use **Settings and admin, Reset demo**.

1. **Sign in as `ceo`.** Click the `ceo` row in the demo box, **Continue**, then **Use code**.
   The portfolio opens: 12 decisions, SGD 4.30m at risk, two on watch, none awaiting reopen.
2. **Open D-07,** "Single source cold chain with FrostLink, three year term". Three assumptions
   hold. The rejected options are collapsed and muted, kept on file.
3. **Go to Signal inbox** and load the **FrostLink rate notice** sample (or paste the email).
   It announces a 19 percent rate rise from 1 November.
4. **Run agent.** The trace reveals eight steps, one every 400 ms: read, extract the 19 percent
   rise, match against 34 assumptions across 12 decisions, test A-104 (42.00 times 1.19 equals
   49.98, above 42.00), verdict broken at 0.91, D-07 moves to reopen, 1 of 2 rejected options
   is now favourable, brief drafted.
5. **Open brief.** The one page reopen brief: what changed, the broken assumption, SGD
   1,240,000 at risk, notify Joanne Lim and Priya Raman, give FrostLink notice before
   1 October. **Notify stakeholders** mocks the send and logs it.
6. **Back to D-07.** The rejected options panel is now the most prominent thing on the page.
   RO-11, dual source with Nordvale, is **live again**: its original reason (SGD 45.00, 7 percent
   above FrostLink) is struck through, and it is now 10.0 percent cheaper than FrostLink's new
   rate. RO-12, the Tuas cold store, stays closed: it was rejected on capital cost, which no
   rate change touches.
7. **Switch role** from the header menu to Joanne Lim. She sees only her six decisions, and the
   reopen brief is waiting in her tasks.
8. **Show restraint.** Back as `ceo`, run the **Night shift quality report** (1.17 percent
   against a 1.2 percent ceiling: shaky, not broken, D-10 goes on watch) and the **Facilities
   notice** (a 5 percent price rise the agent ignores: zero findings). Optionally switch to
   `dtan` to show the contributor's redacted view.

Timing, measured on the built file in Chrome at 1280 by 720: steps 1 to 7 take 4.2 seconds of
machine time including the full trace animation, and 60 seconds with an 8 second pause for
narration at every step.

### If something goes wrong on stage

| Key | Does | Where |
|---|---|---|
| **R** | Resets to the seeded scenario, instantly. Pressing it twice does nothing more. | Login screen, or signed in as `ceo` |
| **D** | Resets and opens the Signal inbox with the FrostLink notice loaded and **Run agent** focused. Press Enter to run. | Signed in as `ceo` |

The same controls are in **Settings and admin, Demo**. Shortcuts are ignored while typing in a
field. A screen that fails to draw shows a calm recovery card with **Back to home** and **Reset
demo**, and the navigation keeps working. **Skip animation** in the trace panel jumps to the end.

## How the reasoning works

By default the reasoning layer is a deterministic local engine written in TypeScript: it
extracts numbers, percentages, currency amounts and dates from the signal with regular
expressions, applies any stated percentage change to an assumption's last known value,
compares the result against the assumption's threshold, scores keywords and contradicting
keywords for condition assumptions, and writes each rationale from a template, so the same
signal always produces the same verdict, confidence and trace, offline. It is not a language
model and does not understand text beyond those rules. An optional live model mode, off by
default and switched on in Settings, sends the signal and the tracked assumptions to an
OpenAI compatible chat completions endpoint with a strict JSON schema, using an API key that
is stored only in this browser's localStorage; if that call fails, times out or returns
anything malformed, the app falls back to the local engine and says so on screen.

## Project layout

```
src/
  data/       seed scenario, six sample signals, seed consistency checks
  engine/     extraction, LocalEngine, LlmEngine, fallback, rules, revival, brief, pipeline
  state/      store, reducer, persistence, navigation state machine, role selectors
  screens/    login, MFA, portfolio, decision detail, signal inbox, reopen brief, my decisions, contributor, settings
  components/ trace panel, rejected options panel, tables, pills, toasts, error boundaries
docs/index.html   the built single file
SPEC.md           product specification
DECISIONS.md      rulings on points the spec left open
```

No router (a state machine picks the screen, so `file://` works), no backend, no API keys in
the repository.

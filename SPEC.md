# Rethread: product specification

## What it is
A decision system of record that watches the assumptions underneath past decisions. When new
evidence contradicts an assumption, an agent reopens the affected decision, generates a reopen
brief, and resurfaces the options that were rejected at the time, together with the original
reason for rejecting them.

This is a prototype for a hackathon demo. It must run entirely offline and must never fail
in front of an audience.

## Hard constraints
1. No backend. No database server. No login service. Everything runs in the browser.
2. Must work with no network connection at all in its default mode.
3. Must be openable two ways: `npm run dev` for development, and a single self contained
   HTML file that opens by double clicking with no server and no internet.
4. All state persists in localStorage. A "Reset demo" action restores the seeded scenario.
5. No API keys committed to the repository, ever.

## Tech
- Vite, React 18, TypeScript
- Tailwind CSS v3 (pin v3, do not use v4)
- lucide-react for icons
- recharts only if a chart is genuinely needed, otherwise plain SVG
- vite-plugin-singlefile to emit one inlined HTML file into `docs/`
- No router library. A single state machine for the current screen keeps the single file
  build working from `file://`, where path based routing breaks.

## Data model

### Decision
- id, title, summary, decidedOn (ISO date), owner (userId), stakeholders (userId[])
- status: 'active' | 'watch' | 'reopen' | 'superseded' | 'closed'
- valueAtRisk (number, SGD), category, reviewDate
- assumptionIds[], rejectedOptionIds[], evidenceIds[], historyEntries[]

### Assumption
- id, decisionId, statement (human readable)
- test, one of:
  ```ts
  { kind: 'threshold', metric: string, operator: '<=' | '>=' | '==', value: number, unit: string }
  { kind: 'condition', keywords: string[], negativeKeywords: string[] }
  ```
- criticality: 'critical' | 'supporting'
- status: 'holding' | 'shaky' | 'broken'
- confidence (0 to 1), lastTestedOn, evidenceIds[]

### RejectedOption
- id, decisionId, title, description
- rejectedBecause (free text), rejectedBecauseAssumptionId (the assumption whose truth killed it)
- comparableValue (number, so it can be compared against the incumbent when the assumption breaks)
- revivable: boolean, computed at reopen time

### Evidence
- id, source: 'email' | 'meeting-note' | 'metric' | 'regulatory' | 'news' | 'manual'
- receivedOn, title, body (raw text), submittedBy (userId)
- findings[]: { assumptionId, verdict: 'supports' | 'contradicts' | 'neutral', confidence, rationale, extractedValue? }

### ReopenBrief
- id, decisionId, createdOn, triggeringEvidenceId
- whatChanged, brokenAssumptions[], impactStatement
- revivedOptions[]: { optionId, whyItIsLiveAgain, newComparison }
- notifyList (userId[]), recommendedNextStep, status: 'draft' | 'sent' | 'actioned'

### User
- id, name, role: 'executive' | 'owner' | 'contributor', username, password, avatarInitials

## Roles and visibility (this is scored, get it exactly right)
- executive: every decision, every value, every brief, plus the admin panel
- owner: only decisions where owner === user.id, plus reopen tasks assigned to them.
  Values visible only on their own decisions. No portfolio screen.
- contributor: can submit evidence. Sees only decisions where they appear in stakeholders.
  Never sees valueAtRisk, never sees the portfolio, never sees the admin panel.
Enforce this in a single `visibleDecisions(user)` selector used by every screen, not by
hiding buttons in the UI.

## Login
Screen 1: username and password. Screen 2: a 6 digit MFA code.
The current valid code is derived from the minute (a simple deterministic function, this is a
prototype) and is shown on screen in a dashed "demo mode" box so the demo cannot stall.
Wrong password and wrong code both show proper error states. Include a 3 attempt lockout that
resets after 10 seconds, so the security story is demonstrable.

Seed accounts:
- ceo / demo1234, Priya Raman, executive
- jlim / demo1234, Joanne Lim, owner (logistics)
- dtan / demo1234, Daniel Tan, contributor (operations coordinator)

## The reasoning engine
Define an interface:

```ts
interface ReasoningEngine {
  analyse(evidence: Evidence, assumptions: Assumption[]): Promise<Finding[]>
}
```

Ship two implementations.

1. LocalEngine (default, offline, deterministic)
   - Extracts numbers with units and percentages from the evidence body
   - For threshold assumptions: applies a stated percentage change to the assumption's current
     value, or reads an absolute figure, then compares against the threshold
   - For condition assumptions: keyword and negative keyword matching with a simple scoring
     function
   - Returns a verdict, a confidence between 0 and 1, and a one sentence rationale in plain
     English that names what it found and what it compared it to
   - Must emit intermediate steps so the UI can show a trace

2. LlmEngine (optional, off by default)
   - Reads an API key from a settings field stored in localStorage only
   - Calls a chat completions endpoint with a strict JSON schema response
   - Falls back to LocalEngine on any error, with a visible toast saying it fell back
   - A banner in settings warns that the key lives in the browser and must never be committed

A toggle in Settings switches engines. Default is LocalEngine.

## Agent trace (this is the demo centrepiece)
When evidence is analysed, show a stepped trace panel that reveals one step at a time with a
short delay between steps, roughly 400ms, so the audience can follow. Steps:
1. Reading signal: source, date, length
2. Extracting claims: list what was found, for example "rate increase of 19 percent effective
   1 November"
3. Matching against 34 tracked assumptions across 12 decisions
4. Testing assumption A-104: "unit rate stays at or below SGD 42 per pallet".
   Computed 42.00 times 1.19 equals 49.98. 49.98 is greater than 42.00.
5. Verdict: broken, confidence 0.91
6. Decision D-07 status: active becomes reopen
7. Checking rejected options for revivability: 1 of 2 options is now favourable
8. Drafting reopen brief and notify list

Include a "Skip animation" control in case the presenter is short of time.

## Screens
1. Login (two steps as above)
2. Portfolio dashboard, executive only
   - Metric tiles: active decisions, on watch, awaiting reopen, value at risk, assumptions
     broken in the last 30 days, median days from break to reopen
   - Decision table: title, owner, status pill, value at risk, assumption health bar
     (small stacked bar: green holding, amber shaky, red broken)
   - Filter by status and by owner
3. Decision detail
   - Header: title, status pill, owner, decided on, value at risk, review date
   - Assumptions list with status, confidence, last tested, and the test in plain English
   - Rejected options panel. Muted and collapsed while the decision is healthy. When the
     decision is in reopen state it expands, is visually prominent, and each revivable option
     shows a "live again" marker with the comparison that makes it live
   - Evidence timeline, newest first, each entry showing which assumptions it touched
   - History log of every status change with timestamp and cause
4. Signal inbox
   - Large paste area, plus a list of 6 sample signals that can be loaded with one click
   - "Run agent" button, the trace panel, and the result summary
5. Reopen brief
   - A printable one page layout: what changed, assumptions broken, decisions affected,
     options now live again with the original rejection reason struck through, notify list,
     recommended next step
   - "Notify stakeholders" button that mocks sending and writes to the history log
6. My decisions, for the owner role
7. Contributor view: submit evidence, and a read only list of decisions where they are a stakeholder
8. Settings and admin: engine toggle, confidence thresholds, seeded users, reset demo

## Seed scenario
Company: Calder Group, a regional food distribution business, fictional.
12 decisions, 34 assumptions, 18 rejected options, 9 historical evidence items.
Portfolio value at risk: about SGD 4.3 million. Two decisions already on watch so the
dashboard is not all green at the start.

The hero decision, D-07:
- Title: "Single source cold chain with FrostLink, three year term"
- Decided 2026-03-12, owner Joanne Lim, value at risk SGD 1,240,000
- Review date 2026-11-01, which is also the auto renewal date
- Assumptions:
  - A-104 critical threshold: unit rate stays at or below SGD 42.00 per pallet
  - A-105 critical condition: FrostLink retains halal certification
    (negative keywords: certification lapsed, suspended, withdrawn, revoked)
  - A-106 supporting threshold: our weekly volume stays at or above 800 pallets
- Rejected options:
  - RO-11 "Dual source with Nordvale and FrostLink", rejected because Nordvale quoted
    SGD 45.00 per pallet, 7 percent above FrostLink. Killed by assumption A-104.
    comparableValue 45.00, so when FrostLink moves to 49.98 this option becomes favourable.
  - RO-12 "Build own cold store at Tuas", rejected on capital cost of SGD 6.8 million.
    Not revived by a rate change, and must stay greyed out. The demo is stronger if only
    one of the two options revives, because it shows judgement rather than a blanket rule.

Sample signal that triggers the demo, stored as one of the six one click samples:

```text
From: contracts@frostlink.example
Subject: Notice of rate revision and Jurong consolidation
Date: 2026-09-18

Dear partner, effective 1 November 2026 our per pallet handling rate will increase by 19
percent across all Singapore facilities. We are also consolidating our Jurong operation
into the Tuas South site from the same date. Existing contracts renew on the revised
schedule unless notice is given 30 days prior.
```

Expected result: A-104 breaks at confidence about 0.91, D-07 flips to reopen, RO-11 revives,
RO-12 does not, a brief is generated naming Joanne Lim and Priya Raman, and the recommended
next step is to give notice before 1 October.

Also include among the six samples:
- One signal that produces "shaky" rather than "broken", to show restraint
- One signal that is genuinely irrelevant and produces no findings, to show the agent does
  not fire on noise. This is worth more in Q&A than three extra features.

## Visual design
- Clean, dense, professional. Not a toy. Think an internal tool used by a director.
- Neutral slate background, one accent colour, semantic colours only for status:
  holding green, shaky amber, broken red.
- Status pills, not coloured rows. Numbers right aligned. Tabular numerals.
- Works at 1280 by 720, which is a typical projector. Test at that size.
- Light mode only. Do not spend time on dark mode.
- No emoji anywhere in the interface.

## Definition of done
- `npm run dev` serves the app
- `npm run build` emits `docs/index.html` as one self contained file under 5 MB
- Opening `docs/index.html` directly from the file system with wifi off performs the entire
  demo from login to reopen brief without a single network request
- All three roles log in and see demonstrably different screens
- The hero scenario runs end to end in under 90 seconds including the trace animation
- Reset demo restores the seed exactly
- README documents the three logins, the demo script and the reset

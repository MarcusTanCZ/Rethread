# Build decisions

Rulings on points SPEC.md leaves open. SPEC.md stays the source of truth for everything else.

## Confirmed by Marcus, 2026-09-25

- **Notice date.** Keep the spec wording: "give notice before 1 October". `actionBy` for the D-07
  brief is 2026-10-01. Do not show the computed 2 October deadline.
- **Owner scope.** Reopen tasks only arise from decisions the owner owns, so `visibleDecisions`
  stays the single rule and no task ever points at a decision the owner cannot see.
- **Signal inbox access.** The inbox and full agent trace are for executive and owner roles.
  Contributors submit evidence from their own view and see a redacted result: counts only,
  naming only decisions where they are a stakeholder, never values.
- **Demo clock.** A fixed demo date of 2026-09-25 drives every relative metric and date, so
  Reset demo restores the seed exactly. The seed includes past break to reopen pairs so the
  median tile has a value.

## Defaults adopted (no objection raised)

- Threshold tests carry `baseline`, `metricAliases` and `scope` so a percentage change is
  applied to the right metric for the right vendor only.
- Notify list is owner plus stakeholders. D-07 stakeholders are Priya Raman only.
- `rejectedBecauseAssumptionId` and `comparableValue` are nullable (RO-12 has neither).
- Status rules: contradicting finding at or above the broken threshold marks an assumption
  broken; below it but above the shaky threshold, or a threshold test passing within a 3 percent
  margin, marks it shaky. Any critical broken assumption moves the decision to reopen; any shaky
  or supporting broken assumption moves it to watch.
- MFA accepts the current and previous minute's code; the demo box shows a countdown.
- One 3 attempt lockout counter shared across both login steps, 10 second reset.
- LlmEngine targets an OpenAI compatible chat completions endpoint; any failure, including CORS
  from file://, falls back to LocalEngine with a toast.
- Trace counts ("34 tracked assumptions across 12 decisions") are computed, not hard coded.
- Seed passwords are plain text demo credentials; no hashing.
- `negativeKeywords` on condition tests means phrases that contradict the assumption.

## Demo hardening, 2026-09-25

- **Reset demo** is instant and idempotent: no confirmation step, the seed is rebuilt from
  constants, and pressing it twice leaves the same data as once. It keeps who is signed in and
  any LLM key. Each reset bumps an epoch, so an agent run still animating when the reset
  happens is discarded rather than written into the fresh seed.
- **Run hero scenario** (and the D shortcut) resets first, then opens the inbox with the
  FrostLink notice loaded and Run agent focused. Resetting first is what makes a misclick
  recoverable: the hero run only reopens D-07 from the seeded state.
- **Shortcuts** R and D work on the login screen and for the executive only, and are ignored
  while typing. Owners and contributors get a notice instead, so the role story holds on
  stage. They are presenter controls, not a security boundary.
- A signed in user whose saved role is not one of the three known roles is treated as signed
  out, rather than crashing navigation.

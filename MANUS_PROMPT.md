# Manus prompt for publishing Rethread

Attach `docs/index.html` to a new Manus task, then paste everything between the two lines below.
(If you would rather Manus pull from GitHub, replace the first paragraph of the prompt with:
"Deploy the static site in the `docs/` folder of https://github.com/MarcusTanCZ/Rethread,
branch main. The site is the single file `docs/index.html`.")

---

## Task

Publish the attached `index.html` as a public static website and verify it against the
specification below. Give me the live URL when done.

The file is a finished, tested build of the web app described in the specification. It is a
single self-contained page: React, styles and seed data are already compiled and inlined.
**Your job is to deploy and verify it, not to build or redesign it.**

### Deployment rules

1. Serve the attached file unchanged as the site's index page. Do not rebuild it, regenerate it
   from the specification, reformat, minify, split it into files, or "improve" it.
2. Static hosting only. No framework, no build step, no server code, no database.
3. Do not add analytics, trackers, fonts, CDNs or any external script or stylesheet. The app
   makes no network requests and stores its demo data in the browser's localStorage.
4. If a check below fails, do not edit the file. Report exactly which check failed, what you
   saw, and a screenshot. I will fix the source and send a new build.

### Specification (what the app does; use it to verify, not to rebuild)

Rethread is a decision system of record. It watches the assumptions behind past business
decisions and reopens a decision when new evidence breaks one of them.

**Roles and login.** Three roles: executive, decision owner, contributor. Login requires a
username, a password, and then a 6 digit MFA code, with the valid code displayed on screen in a
demo box. Seeded accounts: `ceo` / `demo1234` Priya Raman, executive; `jlim` / `demo1234`
Joanne Lim, owner; `dtan` / `demo1234` Daniel Tan, contributor. The executive sees all decisions,
all values and an admin panel. The owner sees only decisions they own. The contributor can only
submit evidence and view decisions where they are a named stakeholder, and never sees financial
values.

**Data.** Each decision has a title, date, owner, stakeholders, status, a value at risk in
Singapore dollars, a review date, a list of assumptions, and a list of options rejected at the
time with the reason each was rejected. Each assumption is a testable statement, either a numeric
threshold such as "unit rate stays at or below SGD 42 per pallet" or a named condition such as
"supplier retains halal certification", with a status of holding, shaky or broken.

**The agent.** A signal inbox where a user pastes an email, meeting note, metric or news item. An
agent reads it, extracts the claims, tests them against every tracked assumption, and returns a
verdict with a confidence score and a plain English rationale, showing its reasoning step by step
on screen. When a critical assumption breaks, the decision flips to reopen, a reopen brief is
generated, and any option rejected because of that assumption is marked live again, with the
original rejection reason struck through beside the new comparison.

**Screens.** Login; executive portfolio dashboard with metric tiles and a decision table;
decision detail with assumptions, rejected options and an evidence timeline; signal inbox with
the agent trace; reopen brief as a printable one pager; my decisions for owners; contributor
evidence submission; settings with a reset demo control.

**Seed.** Fictional regional food distributor Calder Group: 12 decisions, 34 assumptions, 18
rejected options, about SGD 4.3 million at risk. Hero decision D-07, "Single source cold chain
with FrostLink, three year term", decided 12 March 2026, owned by Joanne Lim, SGD 1,240,000 at
risk, renewing 1 November 2026, resting on: unit rate at or below SGD 42 per pallet; FrostLink
retains halal certification; weekly volume at or above 800 pallets. Rejected options: "Dual source
with Nordvale" (the app titles it "Dual source with Nordvale and FrostLink"), rejected because
Nordvale quoted SGD 45 per pallet, 7 percent higher; "Build own cold store at Tuas", rejected on
SGD 6.8 million of capital cost.

**Samples.** One click sample signals include the FrostLink email of 18 September 2026 (19
percent rate rise from 1 November, Jurong consolidation), one signal that produces a shaky verdict,
and one irrelevant signal that produces no findings.

**Design.** Clean, dense professional internal tool on a neutral slate palette with one accent
colour, colour used only for status, no emoji, good at 1280 by 720.

### Verification on the live URL

Use a browser window of 1280 by 720. Tick each item and report the result.

1. The page loads to a **Sign in** screen with a dashed **Demo mode** box listing `ceo`, `jlim`
   and `dtan`. The browser console shows no errors, and no request goes anywhere except the page
   itself.
2. Sign in as `ceo` / `demo1234`. The next screen asks for a 6 digit code and shows the current
   code in a **Demo mode** box; **Use code** signs in.
3. Press the **R** key once (outside any text field) to start from clean demo data.
4. **Portfolio** shows six metric tiles (value at risk SGD 4.30m, 2 on watch, 0 awaiting reopen)
   and a table of 12 decisions.
5. Open **D-07**. Its three assumptions show **Holding**. The **Rejected options** row is collapsed
   and grey.
6. Open **Signal inbox**, click the sample **FrostLink rate notice**, click **Run agent**. The
   **Agent trace** reveals 8 steps one at a time, including "Computed 42.00 times 1.19 equals
   49.98." and "Verdict: broken, confidence 0.91", then "Decision D-07 status: active becomes
   reopen" and "1 of 2 options is now favourable".
7. Click **Open brief**. The reopen brief names Joanne Lim and Priya Raman and recommends giving
   FrostLink notice **before 1 October**.
8. Go back to **D-07**. A panel reads "1 rejected option is live again": RO-11 is marked **Live
   again** with the SGD 45.00 rejection reason struck through beside "SGD 45.00 per pallet against
   SGD 49.98 per pallet now, 10.0 percent lower". RO-12, the Tuas cold store, is greyed out and
   marked **Still closed**.
9. In **Signal inbox**, run **Night shift quality report**: the result is **shaky**, not broken,
   and D-10 goes on watch. Run **Facilities notice**: "No findings" and no decision changes.
10. Use the account menu (top right) to switch to Joanne Lim (`jlim`): only 6 decisions are
    visible, with values, and the reopen brief appears under **Reopen tasks assigned to you**.
11. Switch to Daniel Tan (`dtan`): the only menu item is **Submit evidence**, only 4 decisions are
    listed, **D-07 is not among them**, the table has no value column, and opening any of them
    shows **Value at risk: Restricted**.
12. As `ceo`, open **Settings and admin** and click **Reset demo**. D-07 returns to Active.

Finish by pressing **R** as `ceo` so the published site's demo data in your browser is clean,
then reply with: the live URL, the result of each check, and screenshots of checks 6 and 8.

---

## Notes for the presenter

- Each browser keeps its own demo data per site address. Press **R** as `ceo` before presenting.
- The Manus link needs internet. For an offline pitch, open `docs/index.html` from disk.
- If Manus reports a failed check, fix it in the source, run `npm run build`, and send the new
  `docs/index.html`. Never let the agent patch the built file.

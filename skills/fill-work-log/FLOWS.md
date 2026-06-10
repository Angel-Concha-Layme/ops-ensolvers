# Fill Work Log — Flows

Example scenarios for the `fill-work-log` skill, written as a **manual, TDD-style acceptance checklist**. Each flow is something you can read and then reproduce by hand against a real OPS work-log to confirm the skill behaves as described. They are the source of truth for *expected behavior*; the skill (`SKILL.md`) is implemented to match them.

> **No real data here.** All cards, branches, and text are generic placeholders. Nothing in this file is OPS/Jira internal data.

## Conventions used in these flows

Placeholders reused across scenarios:

| Placeholder | Meaning |
|---|---|
| `ABC-123:Refactor the billing module` | Card 1 (code + name) |
| `DEF-456:Fix timezone bug in reports` | Card 2 (code + name) |
| `feature/ABC-123-refactor-the-billing-module` | A git branch that encodes Card 1 |

Description template (see `SKILL.md` → *Format*):

```
Standup. Software Development. <JIRA_CODE>:<JIRA_CARD_NAME>. <what was done>
```

Defaults assumed unless a flow says otherwise: user is logged in, single assignation, target is today (a business day), Hours = `8`, Internal Description = External Description, Worklog Type = `REGULAR`. Writes are **unattended**: non-destructive saves (add/append) happen directly and the run ends with a report of the saved entry. The skill only asks when saved text would be **rewritten** (F13), the request is **ambiguous** (F14), information is **missing** (F7, F8), or **login** is needed (F9).

---

## F1 — Fresh fill, card given manually

- **Given** today's row is empty (shows an **Add** button).
- **When** the user says: *"Log today: ABC-123, the billing refactor — split the invoice service and added unit tests."*
- **Then** the skill builds:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service and added unit tests.
  ```

  …rewritten impersonally (no "I did"), mirrors it to Internal Description, **Add → SAVE** directly, verifies the new filled row, and reports the saved entry.

## F2 — Fresh fill, card auto-detected from the git branch

- **Given** today's row is empty, and the skill is invoked from a work repo whose current branch is `feature/ABC-123-refactor-the-billing-module`.
- **When** the user says: *"Fill my OPS work log for today — extracted the invoice service and added tests."*
- **Then** the skill reads the branch (`git branch --show-current`), strips the `feature/` prefix, and proposes the **draft** card:

  ```
  ABC-123:Refactor the billing module
  ```

  It uses the draft directly (the de-slugged title is lossy — casing/articles may be off), builds:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Extracted the invoice service and added tests.
  ```

  …saves directly, and the report **flags that the title was drafted from the branch** so the user can ask for a correction (which then follows F13).

## F3 — Multiple cards in one pass

- **Given** today's row is empty.
- **When** the user says: *"Today I worked on ABC-123 (split the invoice service) and DEF-456 (fixed the timezone bug in reports)."*
- **Then** the skill chains one segment per card into a single Description and saves **once** (a normal Add, not an edit):

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service. DEF-456:Fix timezone bug in reports. Fixed the timezone handling in the reports module.
  ```

## F4 — "Same as yesterday" (and the "+X" variant)

- **Given** the most recent filled day reads:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service and added unit tests.
  ```

- **F4a — When** the user says *"log today, same as yesterday"* → **Then** the skill copies that Description **verbatim** into today's row.
- **F4b — When** the user says *"same as yesterday but also reviewed two PRs"* → **Then** the skill takes yesterday's Description and appends the professionalized addition:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service and added unit tests. Reviewed two pull requests.
  ```

> Note: F4 **creates today's** entry by copying from a *previous* day. It is not the Edit-to-append flow (F5/F6), which modifies a day that is already saved.

## F5 — Non-destructive append to an already-saved day, NEW card

- **Given** today is **already saved** (shows Edit/Delete actions) with:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service.
  ```

- **When** the user says: *"Add to today: I also worked on DEF-456, fixed the timezone bug in reports."*
- **Then** the skill detects the day is filled → uses **Edit** (not Add), reads the current Description, sees `DEF-456` is **not** present, and appends a new segment — preserving the existing text exactly:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service. DEF-456:Fix timezone bug in reports. Fixed the timezone handling in the reports module.
  ```

  Internal Description re-mirrored, **Hours unchanged**, saved directly — the report shows the before/after. **Nothing is deleted or overwritten.**

## F6 — Non-destructive append to an already-saved day, SAME card (merge)

- **Given** today is already saved with:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service.
  ```

- **When** the user says: *"Add to today: on ABC-123 I also added unit tests and updated the docs."*
- **Then** the skill uses **Edit**, sees `ABC-123` **is already present**, and merges the new detail into that card's "what was done" joined with `; ` — keeping the existing detail intact:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service; added unit tests and updated the docs.
  ```

  Internal re-mirrored, Hours unchanged, saved directly and reported (before/after).

## F7 — Branch fallback: no card pattern → ask

- **Given** the skill is invoked from a branch with no card code (e.g. `main`, `develop`, `experiment-spike`, or a detached HEAD / non-repo directory).
- **When** the user says: *"Fill my OPS for today, I did some exploratory work on the billing refactor."*
- **Then** the skill does **not** guess a card from the branch. It asks for the Jira card (code + name), and once given (`ABC-123:Refactor the billing module`) proceeds as in F1.

## F8 — Multiple assignations → ask which

- **Given** the user has more than one assignation (e.g. Project A and Project B), with an empty day to fill.
- **When** the user says: *"Fill my OPS work log."* without naming a project.
- **Then** the skill reads the available assignations (dropdown / Dashboard "Missing Worklogs") and, because there is more than one and the user didn't specify, **asks which assignation** — it never guesses. After the user picks one, it fills that assignation's work-log (and repeats per assignation if asked).

## F9 — First-run authentication (manual Google sign-in)

- **Given** a fresh browser profile not yet logged in to OPS; navigating to OPS redirects to Google sign-in.
- **When** the user invokes the skill.
- **Then** the skill opens OPS, detects the sign-in redirect, and **asks the user to complete "Sign in with Google" manually** in the browser window, waiting for confirmation before continuing. It never types, requests, or stores any credential. Thanks to the persistent profile, later runs skip this.

## F10 — The remaining gates, and fixing an unattended save

- **Given** the skill asked before rewriting saved text (F13) or about an ambiguous request (F14), and the user replies *"cancel"* / *"leave it"* — **then** the skill does **not** click SAVE: it cancels the dialog (**CANCEL**) leaving the day exactly as it was.
- **And given** an unattended save already happened (F1–F6) and the user replies *"no, change the wording to…"* — **then** that is an explicit correction request: the skill fixes the just-saved entry via the **replace** flow (F13).

## F11 — Missing-days sweep: business days only, skip weekends

- **Given** the current month has several empty business-day rows and empty weekend rows.
- **When** the user says: *"Fill my missing OPS days this month."*
- **Then** the skill targets the empty **business-day** rows and **skips weekends** (Sat/Sun) unless the user explicitly asks to include them. It fills and saves each directly; the final report lists every day written (and what was skipped).

> OPS allows filling worklogs **up to 5 days in advance**, so a target day — including today — being already saved is a normal state. F12–F14 cover it.

## F12 — Pre-filled day already matches the request → no-op

- **Given** today is **already saved** (pre-filled) with exactly yesterday's Description:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service and added unit tests.
  ```

- **When** the user says: *"log today, same as yesterday"*.
- **Then** the skill detects today's entry already equals yesterday's and makes **no changes** — no Edit, no SAVE, no confirmation prompt (nothing is being written). It reports the no-op, showing the existing entry.

## F13 — Pre-filled day, explicit replace

- **Given** today is already saved (pre-filled) with:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service.
  ```

- **When** the user says: *"Change today's entry — I actually spent the day on DEF-456, fixing the timezone bug in reports."*
- **Then** the skill recognizes an **explicit change request** → uses **Edit**, builds the replacement, and shows **before → after** so the rewritten text is visible:

  ```
  before: Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service.
  after:  Standup. Software Development. DEF-456:Fix timezone bug in reports. Fixed the timezone handling in the reports module.
  ```

  Only on explicit OK: replace, re-mirror Internal, Hours unchanged, SAVE, verify. Without the OK, nothing is touched (F10 applies).

## F14 — "Same as yesterday" but today differs → ask, never guess

- **Given** yesterday reads:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Split the invoice service.
  ```

  …and today is **already saved** with different text:

  ```
  Standup. Software Development. DEF-456:Fix timezone bug in reports. Fixed the timezone handling in the reports module.
  ```

- **When** the user says: *"same as yesterday"*.
- **Then** the skill does **not** silently overwrite. It shows both texts and asks what to do — **replace** today with yesterday's (then F13's before→after gate applies), **append** (then F5/F6 merge rules apply), or **leave** as-is. It only acts after the user picks.

## F15 — "Log what I did in this session" (context-aware fill)

- **Given** the user invokes the skill from a Claude Code session where they've been working on branch `feature/ABC-123-refactor-the-billing-module`, and in that session they extracted the invoice service and added tests.
- **When** the user says: *"add what I did in this session to OPS"* / *"agregá lo que hice en esta sesión"*.
- **Then** the card comes from the branch (as in F2) and `<what was done>` is **summarized from the session's own conversation** — concise, impersonal, only work that actually happened:

  ```
  Standup. Software Development. ABC-123:Refactor the billing module. Extracted the invoice service and added tests.
  ```

  Add or append per the day's state (F1 / F5 / F6 rules). The **composition happens in the main conversation** — a fresh subagent has no session context — and only the browser mechanics are delegated to the `ops-filler` agent (see SKILL.md → *Execution model*).

---

## How to use this as a test pass

Run through the flows that changed (F2, F5, F6, and F12–F15 cover the newest features) plus a couple of the existing ones (F1, F4) as regression checks. For each: perform the **When**, and verify the resulting OPS row matches the **Then** — especially that F5/F6 never lose previously saved text and that F12–F14 never rewrite a saved day without an explicit OK. If everything matches, the skill is good to install locally and use from any terminal.

> Live-validated so far (2026-06-09, against a real work-log): F12 (no-op on a pre-filled identical day); the F4b+F5 hybrid — *"same as yesterday but also X"* on a pre-filled day resolved as a non-destructive append via Edit, saved and verified; and the split execution model — *"tomorrow same as today"* composed in the main conversation and executed by the `ops-filler` agent, including its **conflict gate**: the first dispatch carried a stale expectation (the user had deleted the day's pre-fill between read and write), the agent refused to write and reported the real state, and the re-dispatch created the entry cleanly.

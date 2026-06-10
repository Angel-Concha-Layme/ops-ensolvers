---
name: fill-work-log
description: Automatically fill in the Ensolvers OPS monthly work log at https://ops.ensolvers.com/work-log. Drives Chrome (via the chrome-devtools MCP) to create the day's worklog entry for the current month, professionalizing the user's notes into the standup report format. Use when the user wants to fill/complete/update their OPS work log, log their hours, log their day, do their timesheet, or "cargar el trabajo" on Ensolvers OPS.
---

# Fill Ensolvers OPS Work Log

Creates the user's daily worklog entry on Ensolvers OPS by driving a real Chrome browser through the Chrome DevTools MCP, turning the user's plain notes into the expected standup report format.

> Example scenarios (a manual, TDD-style acceptance checklist) live in [`FLOWS.md`](./FLOWS.md).

## When to use

The user says things like:
- "Fill / complete my OPS work log", "log my work", "cargar el trabajo en OPS"
- "Log today as: <what they did>"
- "Same as yesterday" / "lo mismo que ayer" (optionally "...but also <X>")

## Prerequisites

- The **Chrome DevTools MCP** (`chrome-devtools` server) — **bundled by this plugin** via `.mcp.json` and started automatically; requires Node.js 18+ on the user's machine (it runs via `npx`).
- The user must be **logged in to OPS**. Login is manual (see *Authentication*); this skill never handles credentials.
- Browser tool calls run **without permission prompts**: the plugin ships a `PreToolUse` hook (`hooks/approve-chrome-devtools.js`) that pre-approves the chrome-devtools tools, with navigation restricted to `ops.ensolvers.com`. The flow is **fully unattended** for non-destructive writes — it only asks when saved text would be lost (replace) or information is missing.

## Key facts about the page

Work log URL (params are user-specific — resolve at runtime, never hardcode):

```
https://ops.ensolvers.com/work-log?assignation=<ASSIGNATION_ID>&year=<YEAR>&month=<MONTH>&user=<USER_ID>
```

- `year` / `month` default to **today's** year and month.
- The page shows one row per day of the month.
  - A **filled** day shows: Date, Hours, Description, Internal Hours, Internal Description, and per-row actions (Delete, Edit, Copy Internal Report, Send Internal Report to Slack).
  - An **empty** day shows only an **"Add"** button. Days needing work are the empty rows. Weekends (Sat/Sun) are normally not required — skip unless asked.
- Worklogs can be filled **up to 5 days in advance**, so the target day — even today — may **already be saved** (e.g. the whole week pre-filled). A filled target day is a normal state, not an error: decide between **append**, **replace**, or **no-op** (see *Adding to / Replacing an already-filled day*).
- The **Dashboard** (`/dashboard`) has a "Missing Worklogs" block that links straight to the right assignation + period with the missing day. This is the fastest entry point.

### The "Add" / Create Worklog form

Clicking **Add** on a day opens the *Create Worklog* dialog with these fields:

| Field | Notes |
|-------|-------|
| Assignation | Locked to the selected assignation |
| **Hours** | Required, default `8` (0–24) |
| **Description** | The standup report text (see *Format* below) |
| Internal Hours | Default `8` |
| **Internal Description** | Has a **"COPY EXTERNAL DESCRIPTION"** button. Always set it equal to Description (see *Format*). |
| Worklog Type | Dropdown, default `REGULAR` |
| PRS Pending / Tasks Done / Tasks In Progress / Blockers / Reported issues / Resolved issues | Optional list fields. Leave empty unless the user asks for structured standup. |
| `CANCEL` / `SAVE` | — |

## Assignations

A user can have **several assignations** (different projects), each with its own work log. To choose:
1. Read the available assignations from the **Assignation** dropdown (or from the Dashboard "Missing Worklogs" block).
2. If more than one and the user hasn't said which, **ask** — never guess.
3. Repeat the fill flow per assignation if the user wants more than one.

## Format (how to build the Description)

The Description always follows this template:

```
Standup. Software Development. <JIRA_CODE>:<JIRA_CARD_NAME>. <what was done>
```

- `<JIRA_CODE>:<JIRA_CARD_NAME>` — e.g. `ABC-123:Short description of the card`. If the user worked on several cards, chain a segment per card.
- `<what was done>` — a short, professional summary of the work.

**Professionalization rules** (apply to the user's notes):
- The user may write casually, in English or Spanish.
- Rewrite it **professionally and impersonally** — **never first person** ("se hizo / se implementó", not "hice / I did"). Keep it concise, in the style of the existing entries.
- Default output language: **English** (to match existing worklog entries), unless the user asks otherwise.

**Internal Description = External Description, always.** In the form, after typing the Description, click **"COPY EXTERNAL DESCRIPTION"** so the Internal Description matches exactly.

### Resolving the card (auto-detect from the git branch)

Before asking the user for the Jira card, try to read it from the **current git branch** of the directory the session runs in:

1. Run `git branch --show-current` (treat "not a git repo" / detached HEAD as "no branch").
2. Strip any prefix up to the last `/` (e.g. `feature/`, `fix/`, `bugfix/`, `chore/`).
3. Match a leading card code `[A-Z]{2,}-\d+` (case-insensitive; normalize to uppercase). The remainder is the title slug: split on `-`/`_`, join with spaces, sentence-case it. E.g. `feature/ABC-123-refactor-the-billing-module` → draft `ABC-123:Refactor the billing module`.
4. The de-slugged title is **lossy** (casing, articles), so treat it as a **draft**: use it directly, but **flag it in the final report** ("title drafted from the branch") so the user can ask for a correction if it's off.
5. **No card code in the branch** (`main`, `develop`, a spike branch, detached HEAD, non-repo) → don't guess; **ask** the user for the card.

A branch yields **one** card; if the user worked on more, add the others from what they describe.

### Shortcut intents

Interpret the user's request and pick the right behavior:

- **"Same as yesterday" / "lo mismo que ayer"** → copy the most recent filled day's Description verbatim into the target day. If the target day is **already filled**: identical content → **no-op** (report it, touch nothing); different content → don't guess — show both texts and ask (replace / append / leave).
- **"Same as yesterday but also <X>" / "lo mismo de ayer pero además <X>"** → take the previous day's Description and append the professionalized `<X>`.
- **"Log what I did in this session" / "agregá lo que hice en esta sesión"** → build `<what was done>` from the **current conversation's own context**: summarize the session's actual work (what was implemented / fixed / reviewed) concisely and impersonally — never invent work that didn't happen. The card still comes from the git branch (see *Resolving the card*). This intent is why **composition must happen in the main conversation**: a fresh subagent has no session context (see *Execution model*).
- **Otherwise** → build a fresh Description from the template above using the card(s) and the work the user describes. If the Jira code/name is missing, try the git branch first (see *Resolving the card*), then fall back to asking.

## Execution model (compose here, drive there)

Split the work so runs stay fast:

1. **Compose in the main conversation** — it has the context the work needs: the user's notes, the git branch, and (for the session intent) the session's own history. Produce the **final Description text**, the target day(s), the mode (`add` | `append` | `replace` | `same-as`), and Hours **before touching the browser**. Resolve everything askable (card, assignation if known, replace OK) here too.
2. **Delegate the browser mechanics** to the plugin's **`ops-filler`** agent (fast model, fresh context) via the Agent tool: pass the composed Description verbatim plus day/mode/hours. The agent drives OPS and returns JSON — the saved row, or a **gate** it refused to cross (`login`, `assignation`, `conflict`, `save-failed`).
3. **Handle gates in the main conversation** (ask the user only if genuinely needed), then re-dispatch with the answer.

If the `ops-filler` agent type is unavailable, run the same browser flow inline following this skill — same rules, same protocol.

## Run style (quiet, fast, unattended)

- **No narration.** Don't announce intents, detected shortcuts, plans, or step-by-step progress. Run the flow silently and speak only at the end — or when input is genuinely required (missing card, multiple assignations, the replace gate, login).
- **The final message is the report**: the target day(s) with the saved Description — before → after when a saved entry was edited — plus anything skipped and why (e.g. a no-op day). Nothing else.
- **Keep payloads small.** Take the full-table snapshot once to resolve uids, then verify state with targeted `evaluate_script` reads (a row's text, a field's value). Use `includeSnapshot: false` on actions and don't re-snapshot after every step.

## Workflow

> Steps 1–3 happen in the main conversation; steps 4–8 are the browser mechanics that `ops-filler` executes when delegated (see *Execution model*).

1. Determine the target period (default: current year/month) and the day(s) to fill (default: empty business-day rows; or the day the user names).
2. Ensure the OPS session is authenticated (see *Authentication*).
3. Resolve the assignation (ask if multiple).
4. Open the work-log for that assignation/period (via Dashboard "Missing Worklogs" or by navigating to the URL).
5. For each target day, look at its row:
   - **Empty** (shows **Add**) → click **Add** to create the entry.
   - **Already filled**, and the user is adding more → use **Edit** to **append** (see *Adding to an already-filled day* — do not recreate it).
   - **Already filled**, and the user explicitly asks to change/correct it → use **Edit** to **replace** (see *Replacing an already-filled day*).
   - **Already filled**, and the entry already satisfies the request (common with pre-filled days) → **no-op**: report the existing entry, change nothing.
6. Fill the form: Hours (`8` default), Description (built per *Format*, including auto-detecting the card from the git branch), Internal Hours (`8`), Internal Description (via **COPY EXTERNAL DESCRIPTION**), Worklog Type (`REGULAR`).
7. Click **SAVE** directly — **no confirmation** for non-destructive writes (creating an empty day's entry, appending to one). Only the **replace** flow asks first (see *Replacing an already-filled day*).
8. Verify the new/updated row appears in the table, and **end with the report**: the day and its final saved Description (before → after if a saved day was edited).

### Adding to an already-filled day (non-destructive)

When the target day is **already saved** (the row shows Edit/Delete actions, not an **Add** button) and the user wants to *add* more work, never recreate or overwrite it — **append** via the row's **Edit** action:

1. Click the day's **Edit** to open the existing entry.
2. Read the **current Description verbatim** and preserve it exactly.
3. **Merge by card:**
   - If the new work's card code is **already present**, append the new detail to *that* card's "what was done", joined with `; `.
   - If the card is **new**, append a fresh ` <CODE>:<TITLE>. <work>` segment after the existing ones — **without** repeating the `Standup. Software Development.` prefix.
4. Re-mirror **Internal Description** to the External one (**COPY EXTERNAL DESCRIPTION**).
5. Leave **Hours** unchanged unless the user asks to change them.
6. **SAVE** directly, and include the **before → after** of the Description in the final report.

**Non-destructive guarantee:** this flow only appends — it never deletes a row, nor removes or rewrites text that was already there.

### Replacing an already-filled day (explicit request only)

Because days can be pre-filled in advance, the user may need to **change** what a saved day says ("change today's entry to…", "cambiá lo de hoy", "correct yesterday's worklog"). Rewriting saved text is allowed **only** on an explicit change/correction request — never as the default reading of "fill my day". This is the **only flow that still asks for confirmation**, because text would be lost otherwise:

1. Click the day's **Edit** to open the existing entry.
2. Build the replacement Description per *Format* (professionalize, resolve the card as usual).
3. Show the **before → after** of the Description — this is the one flow that rewrites saved text, so make the replaced text visible — and get an explicit OK.
4. On OK: replace the Description, re-mirror **Internal Description** (**COPY EXTERNAL DESCRIPTION**), leave **Hours** unchanged unless asked, **SAVE**, and verify the row updated.

If the request is **ambiguous** between append and replace (e.g. "same as yesterday" when the target day is already filled with something different), don't pick — show the current and proposed texts and **ask**: replace, append, or leave as-is. And if the saved entry **already matches** the request exactly, change nothing and report the no-op.

### Implementation notes (gotchas learned live)

- The work-log **table renders lazily**. Right after navigating, the a11y snapshot can show "No data to display" before rows exist. **Wait for a day row to appear** (e.g. wait for the text `"Mon 08, Jun"`) before reading the table or locating an **Add** button.
- After clicking **SAVE**, the immediate snapshot may be **stale** (still showing the open dialog). Confirm success with a fresh screenshot/snapshot: the dialog closes and the target day changes from an **Add** button to a filled row with Delete/Edit/Copy/Send actions.
- The **Day** filter defaults to `Calendar Week` but the table still lists every day of the month — no need to change it to see all days.
- The worklog dialog's text fields are **React-controlled inputs**: the plain `fill` tool can write the DOM **without updating React state**. Any re-render (e.g. clicking **COPY EXTERNAL DESCRIPTION**) reverts the visible text, and **SAVE persists the React state** — so a DOM-only fill can silently save the OLD text. Set the Description via `evaluate_script` using the **native value setter + `input` event** instead:

  ```js
  (el) => {
    const set = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value").set;
    set.call(el, TEXT);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  ```

  Set **both** Description and Internal Description this way in a **single** `evaluate_script` call (skip the **COPY EXTERNAL DESCRIPTION** button — setting both fields directly achieves the same invariant in fewer steps), then **SAVE**, then verify against the **table row text** (the ground truth): if the row still shows the old text, the state didn't take — reopen Edit and retry. The a11y snapshot `value` can be stale here; trust `evaluate_script` reads and the saved row only.

## Authentication

- OPS opens in the Chrome instance controlled by the chrome-devtools MCP, which uses a **persistent profile** — the session survives across runs.
- The **first time**, if redirected to Google sign-in, ask the user to complete **"Sign in with Google"** manually in the browser window, and wait for them to confirm before continuing.
- **Never** type, request, or store any password or credential.

## Privacy & safety

- No credentials are ever stored or transmitted.
- No user ids, assignation ids, or internal OPS data are hardcoded in this repo — everything user-specific is resolved at runtime from the authenticated session.
- Non-destructive writes (add/append) save directly and are reported afterwards; **rewriting saved text always requires an explicit OK** (before → after shown).

## Pending / future features

- **Jira integration**: look up the **canonical card title** from Jira. The git-branch auto-detect (see *Resolving the card*) already supplies the code and a *draft* title, but that title is de-slugged from the branch, not the real Jira name. *(Not implemented yet.)*

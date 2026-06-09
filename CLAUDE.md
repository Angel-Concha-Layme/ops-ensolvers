# CLAUDE.md — ops-ensolvers

Context for Claude Code working in this repository. (Auto-loaded when a session
starts from this directory.)

## What this is

**ops-ensolvers** is a Claude Code **plugin** with a single purpose: automatically
fill the **Ensolvers OPS** monthly work log (`https://ops.ensolvers.com/`) by
driving a real Chrome browser through the **chrome-devtools MCP**. It is a
personal, open-source learning project.

## Scope — keep it tight

- **Only** filling the OPS work log. No generalization, no "framework", no extra
  platforms, no future phases — unless the user explicitly asks.
- If tempted to generalize or add scope, note it in one line and move on.

## How it works

- The plugin ships one skill: **`skills/fill-work-log/SKILL.md`** — that file is
  the source of truth for the behavior. Read it before working on the flow.
- Execution is split: the **main conversation composes** the
  Description (it holds the user's notes / branch / session context — required
  for the "log what I did in this session" intent), and the
  **`agents/ops-filler.md` agent** (fast model, fresh context) drives the
  browser mechanics and reports back JSON.
- It drives Chrome via the **chrome-devtools MCP**, which the plugin **bundles**
  in `.mcp.json` (server name `chrome-devtools`, run via `npx`) — installing the
  plugin is enough; no separate MCP setup. Requires Node.js 18+ on the user's
  machine.
- The user signs in to OPS manually (**Sign in with Google**) the first time. The
  chrome-devtools profile is **persistent**
  (`~/.cache/chrome-devtools-mcp/chrome-profile`), so the OPS session survives
  across runs and across Claude sessions — usually no re-login needed.
- **Golden rule:** writes are **unattended** — non-destructive
  saves (add/append) happen directly and the run ends with a report of the saved
  entry. The **only** confirmation kept is before **rewriting saved text**
  (replace: before → after + OK). The per-write pre-SAVE OK was explicitly
  rejected by the user as too much friction.

## Repo structure

```
.claude-plugin/{plugin.json, marketplace.json}   # self-contained plugin + marketplace (source "./")
.mcp.json                                         # bundled chrome-devtools MCP server (run via npx)
skills/fill-work-log/{SKILL.md, FLOWS.md}         # the playbook (authoritative) + TDD-style scenarios
agents/ops-filler.md                              # browser-mechanics executor (fast model)
hooks/{hooks.json, approve-chrome-devtools.js}    # PreToolUse auto-approval (scoped to OPS)
README.md, LICENSE (MIT), .gitignore
CLAUDE.md                                         # this file
```

## Conventions

- Everything (code, commands, docs) in **English**.
- The Worklog Description format and all behavior live in `SKILL.md` — keep that
  the single source of truth; don't duplicate the rules elsewhere.
- **Privacy:** never commit credentials, user ids, assignation ids, or internal
  OPS data. Resolve all user-specific values at runtime from the logged-in
  session.

## Dev workflow

- To test the flow: open OPS → ensure logged in → reach the work-log (Dashboard →
  "Missing Worklogs" is the fast path) → click **Add** on the missing day → fill →
  **SAVE** → verify the new row appears.

## Status

Pre-release. Validated **end-to-end**: filled a real missing day successfully
(session persisted, no re-login). Run locally as a user-scope plugin from this
repo's path (local marketplace).

Permission prompts are solved by a **plugin-shipped `PreToolUse` hook**
(`hooks/approve-chrome-devtools.js`): it auto-approves the chrome-devtools MCP
tools, with navigation restricted to `ops.ensolvers.com` (anything else falls
through to the normal permission flow). Plugins can't ship permission *rules* by
design — the hook is the sanctioned mechanism, accepted at plugin-install time.
The hook's regex matches the `chrome-devtools` server under any prefix — the
bundled `mcp__plugin_ops-ensolvers_chrome-devtools__*`, the standalone
chrome-devtools-mcp plugin, or a directly-configured server.

## Next steps

1. **Future:** Jira integration to auto-fetch the day's cards.

## Working preferences

- Keep scope tight; recommend rather than over-survey options.
- Confirm before irreversible OPS writes (SAVE) and before outward actions
  (pushing, publishing, installing).
- **Minimize chat friction** in the fill flow: permission prompts are solved by
  the plugin's PreToolUse hook; writes are **unattended** (no pre-SAVE OK — the
  user rejected it); **no intent/progress narration** — the final message is
  just the day's report. The only asks left: replace gate, ambiguity, missing
  card, multiple assignations, login.

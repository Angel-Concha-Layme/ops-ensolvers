# ops-ensolvers

A [Claude Code](https://claude.com/claude-code) plugin that **automatically fills
in your [Ensolvers OPS](https://ops.ensolvers.com/) monthly work log**.

You ask Claude to log your work, and the plugin drives a real Chrome browser to
fill in the work-log page for the current month — handling the right project
assignation along the way.

> 🚧 **Status: pre-release.** The work-log automation skill is in place and has
> been validated end-to-end (it filled a real missing day). The Standup
> description format is implemented; Jira integration (auto-fetching the day's
> cards) is the main pending feature.

## How it works

- The plugin ships a skill, **`fill-work-log`**, that automates
  `https://ops.ensolvers.com/work-log`.
- It uses the **Chrome DevTools MCP** to control a real Chrome instance. The
  plugin **bundles** that MCP server (via `.mcp.json`), so installing the plugin
  is enough — you don't configure it separately.
- The text of your entry is composed **in your conversation** — so you can say
  *"log what I did in this session"* and it summarizes the actual session work
  (the Jira card is read from your git branch). The browser mechanics then run
  on a **fast sub-agent** (`ops-filler`), keeping runs quick.
- You **log in to OPS yourself** (Sign in with Google) the first time. The
  browser profile is persistent, so the session is remembered afterwards.
- **No credentials are ever stored.** No user ids, assignation ids, or internal
  OPS data are committed to this repository.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- **Node.js 18+** (the bundled Chrome DevTools MCP runs via `npx`, which fetches
  it on first use). Google Chrome is launched automatically.

> The **Chrome DevTools MCP** server is bundled with this plugin (`.mcp.json`),
> so you don't install it yourself. On first run, `npx` downloads
> `chrome-devtools-mcp` on demand.
>
> **Windows note:** if `npx`-based MCP servers fail to start (a known
> `nvm-windows` issue), install the server globally
> (`npm install -g chrome-devtools-mcp@latest`) and point `.mcp.json`'s
> `command`/`args` at the absolute `node.exe` + the package's bin script.

## Install

```text
# Add this repo as a plugin marketplace
/plugin marketplace add Angel-Concha-Layme/ops-ensolvers

# Install the plugin
/plugin install ops-ensolvers@ops-ensolvers
```

### Permissions: it runs unattended, by design

By default, Claude Code asks for confirmation on **every** browser action
(navigate, click, fill…), which would defeat the point of automating the work
log. Plugins can't grant themselves permission rules (by design), so this plugin
ships the sanctioned alternative: a **`PreToolUse` hook**
([`hooks/approve-chrome-devtools.js`](./hooks/approve-chrome-devtools.js)) that
auto-approves the Chrome DevTools MCP tool calls. You accept it once, when you
trust the plugin at install time.

The hook's scope is deliberately narrow:

- Browser tools (snapshot, click, fill, wait, screenshot…) → **pre-approved**.
- Page navigations → pre-approved **only towards `ops.ensolvers.com`**. Any
  other URL falls back to Claude Code's normal permission flow (your rules, or
  a prompt).
- It never auto-approves anything else, and it never denies — it only removes
  friction for the OPS flow.

The flow runs **fully unattended** for non-destructive writes: it saves directly
and ends by showing you the entry exactly as saved. It only stops to ask when
saved text would be **rewritten** (you get a before → after first), when a card
or assignation is missing/ambiguous, or for the first login.

> Prefer prompts? Inspect the hook with `/hooks`, or uninstall/disable the
> plugin — the hook only exists while the plugin is enabled.

## Usage

Invoke the skill from Claude Code:

```text
/ops-ensolvers:fill-work-log
```

…or just ask in natural language, e.g. *"fill in my OPS work log for this
month."*

The first run will ask you to sign in to OPS in the browser window. After that,
your session is remembered.

## Privacy

This plugin never reads, stores, or transmits your credentials. Authentication
happens entirely in your own browser session. Everything user-specific (your OPS
user id, your assignations) is resolved at runtime from the page you are logged
into — nothing personal is stored in this repository.

## License

[MIT](./LICENSE)

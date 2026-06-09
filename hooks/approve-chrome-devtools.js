#!/usr/bin/env node
// ops-ensolvers — PreToolUse auto-approval for the Chrome DevTools MCP tools.
//
// Why: without this, Claude Code asks for confirmation on every browser action
// (navigate, click, fill…), which defeats automating the work log. Permissions
// can't be granted by a plugin directly (by design), but a plugin MAY ship a
// PreToolUse hook that approves specific tool calls — the user accepts that at
// plugin-install time.
//
// Scope (deliberately narrow):
//   - Browser tools (snapshot, click, fill, wait, screenshot…) → pre-approved.
//   - Page navigations (navigate_page / new_page) → pre-approved ONLY towards
//     https://ops.ensolvers.com. Any other URL produces NO decision, so Claude
//     Code's normal permission flow (your own rules / a prompt) applies.
//   - Non chrome-devtools tools → never touched (no decision).
//
// This hook never denies anything — it only removes friction for the OPS flow.

'use strict';

const OPS_ORIGIN = 'https://ops.ensolvers.com';

// chrome-devtools MCP tool names. The `chrome-devtools` server can reach this
// hook under a few prefixes:
//   - bundled by THIS plugin via .mcp.json:
//       mcp__plugin_ops-ensolvers_chrome-devtools__<tool>
//   - provided by the standalone chrome-devtools-mcp plugin:
//       mcp__plugin_chrome-devtools-mcp_chrome-devtools__<tool>
//   - a directly-configured MCP server:
//       mcp__chrome-devtools__<tool>
// Plugin prefixes are namespaced as `plugin_<plugin>_<server>` and are
// sometimes rendered with ":" separators, so match any leading segments and
// anchor on the `chrome-devtools` server name right before the tool.
const TOOL_RE = /^mcp__(?:[a-z0-9-]+[_:])*chrome-devtools__(.+)$/i;

function isOpsUrl(url) {
  try {
    return new URL(url).origin === OPS_ORIGIN;
  } catch {
    return false; // unparseable URL → don't auto-approve the navigation
  }
}

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let decision = null;
  try {
    const input = JSON.parse(raw);
    const match = TOOL_RE.exec(input.tool_name || '');
    if (match) {
      const tool = match[1];
      const url = input.tool_input ? input.tool_input.url : undefined;
      const isNavigation = tool === 'navigate_page' || tool === 'new_page';
      // back/forward/reload navigations carry no URL → treated as in-page.
      const approved = !isNavigation || !url || isOpsUrl(url);
      if (approved) {
        decision = {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
            permissionDecisionReason:
              'ops-ensolvers: browser automation pre-approved (navigation restricted to ops.ensolvers.com)',
          },
        };
      }
    }
  } catch {
    // Malformed stdin → no decision; normal permission flow applies.
  }
  if (decision) process.stdout.write(JSON.stringify(decision));
});

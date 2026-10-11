/**
 * dsh-adhd-mode — Host half.
 *
 * DeepSeek Harness port of https://github.com/ayghri/i-have-adhd (MIT).
 *
 * Upstream ships one thing per runtime: a Claude Code `SessionStart` hook that
 * pastes the ADHD ruleset into every session, plus an "always-on" flag file
 * (`~/.claude/.i-have-adhd-always`). DSH has neither, so this bundle supplies
 * the equivalents:
 *
 *   hook   — the ruleset rides `systemPrompt.section()` with a dynamic `text`
 *            thunk. dsh-system-prompt re-evaluates that thunk at every
 *            assembly (lib/index.js:342) and drops sections whose text is empty
 *            (lib/index.js:114), so the section follows the switch with no
 *            restart and no re-registration.
 *
 *            The section is registered on the AGENT's context, not the
 *            profile's: a global section reaches every agent the Host ever
 *            assembles a prompt for, including the subagents a delegation
 *            spawns. `agent.ctx` scopes the contribution to that one agent
 *            (dsh-system-prompt README, "Scoping"), which is what keeps the
 *            ruleset on the agent the reader is talking to. Children are
 *            skipped by delegation depth — see `isSubagent`.
 *   switch — `enabled` is a `.volatile()` Config field. The Loader hands the
 *            plugin a live reference whose `.get()` always returns the current
 *            value, so flipping it takes effect on the very next assembly and
 *            persists in the profile's own patch layer.
 *   page   — the client half (client.js) renders a Settings page
 *            (`settings.section`) plus a compact pill next to the composer
 *            (`conversation.composer.dock`); both read and write this same
 *            volatile field through `ctx.configForms`.
 *
 * The Host half owns no control surface of its own: no command, no tool, and no
 * natural-language matching. The switch in the UI is the only way in, which
 * keeps one writer and one place to look when the mode does not do what the
 * reader expected.
 */
import { readFileSync } from 'node:fs';
import z from '@deepseek-ai/schemastery';

/** Cordis service name; also the loader row id and the settings namespace. */
export const name = 'adhd-mode';

/** Settings namespace == the `cordis.patch.yml` row id == the ConfigForms entry id. */
export const NS = 'adhd-mode';

/** `systemPrompt` renders the section; `agents` is how a top-level agent is found. */
export const inject = ['systemPrompt', 'agents'];

export const Config = z.object({
  enabled: z
    .boolean()
    .default(false)
    .description(
      '常驻注入 ADHD 输出规则 / always-on ADHD output style (live-switchable)',
    )
    .volatile(),
  order: z
    .number()
    .default(15)
    .description('系统提示词段落顺序，数字越小越靠前 / system-prompt section order'),
});

// ---------------------------------------------------------------------------
// The ruleset itself
// ---------------------------------------------------------------------------

const RULES_URL = new URL('./skills/adhd-mode/rules.md', import.meta.url);

const ACTIVE_BANNER = 'ADHD MODE ACTIVE. The ruleset below applies to every response.';

/** Used only if the bundled rules.md cannot be read (kept backtick-free on purpose). */
const FALLBACK_RULES = [
  'ADHD MODE ACTIVE.',
  '',
  '1. Lead with the next action.',
  '2. Number multi-step tasks.',
  '3. End with one concrete next action.',
  '4. Suppress tangents.',
  '5. Restate state every turn.',
  '6. Give specific time estimates.',
  '7. Make completed work visible.',
  '8. Matter-of-fact tone for errors.',
  '9. Cap lists to 5 items.',
  '10. No preamble, no recap, no closing pleasantries.',
].join('\n');

/** Strip a leading YAML frontmatter block (same expression upstream hooks/always-on.mjs uses). */
function stripFrontmatter(text) {
  return text
    .replace(/^---[^\S\r\n]*\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/, '')
    .replace(/(?:\r?\n)+$/, '');
}

function loadRules() {
  try {
    const body = stripFrontmatter(readFileSync(RULES_URL, 'utf8'));
    return body.length > 0 ? body : FALLBACK_RULES;
  } catch {
    return FALLBACK_RULES;
  }
}

// ---------------------------------------------------------------------------
// Config reading (works for both a .volatile() reference and a plain value)
// ---------------------------------------------------------------------------

function flag(value, fallback) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    const resolved = value.get();
    return resolved === undefined ? fallback : resolved;
  }
  return value === undefined ? fallback : value;
}

function bool(value, fallback) {
  return Boolean(flag(value, fallback));
}

function num(value, fallback) {
  const resolved = flag(value, fallback);
  return typeof resolved === 'number' && Number.isFinite(resolved) ? resolved : fallback;
}

/**
 * Whether this agent is a delegated child rather than the agent the reader
 * talks to.
 *
 * `delegationDepth` is the authoritative mark: dsh-subagent stamps it as
 * parent + 1 at creation and persists it in the session header, so it survives
 * restart and resume (a runtime-only depth would let a resumed child read as
 * top-level). `origin: 'subagent'` is the same fact spelled for presentation,
 * and `options.subagentDepth` is the runtime copy. A forked session is NOT a
 * child — `header.parentSession` records fork lineage and a fork is a
 * top-level agent the reader opened on purpose, so it is deliberately not a
 * test here.
 */
function isSubagent(agent) {
  const header = agent?.session?.header ?? {};
  if (header.origin === 'subagent') return true;
  if (typeof header.delegationDepth === 'number' && header.delegationDepth > 0) return true;
  const runtime = agent?.options?.subagentDepth;
  return typeof runtime === 'number' && runtime > 0;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function apply(ctx, config) {
  const options = config ?? {};
  const rules = loadRules();

  const isEnabled = () => bool(options.enabled, false);

  // The hook: one dynamic system-prompt section per top-level agent. `enabled`
  // is read on every assembly, so the switch needs no restart, no remount and
  // no second writer; the section exists only on agents that are not delegated
  // children, so a subagent never carries the ruleset.
  const installed = new Map();

  const install = (agent) => {
    if (installed.has(agent) || isSubagent(agent)) return;
    const scoped = agent.ctx;
    installed.set(
      agent,
      scoped.systemPrompt.section({
        name: NS,
        order: num(options.order, 15),
        text: () => (isEnabled() ? `${ACTIVE_BANNER}\n\n${rules}` : ''),
      }),
    );
  };

  // Agents already live when the plugin loads, then every later publication.
  for (const agent of ctx.agents.list()) install(agent);
  ctx.on('agent/created', ({ agent }) => {
    install(agent);
  });
  ctx.on('agent/disposed', ({ agent }) => {
    installed.get(agent)?.();
    installed.delete(agent);
  });
  ctx.effect(
    () => () => {
      for (const dispose of installed.values()) dispose();
      installed.clear();
    },
    'adhd-mode: system-prompt hook',
  );
}

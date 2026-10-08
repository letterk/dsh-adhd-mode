/**
 * dsh-i-have-adhd — Host half.
 *
 * DeepSeek Harness port of https://github.com/ayghri/i-have-adhd (MIT).
 *
 * Upstream ships one thing per runtime: a Claude Code `SessionStart` hook that
 * pastes the ADHD ruleset into every session, plus an "always-on" flag file
 * (`~/.claude/.i-have-adhd-always`). DSH has neither, so this bundle supplies
 * the equivalents:
 *
 *   hook   — the ruleset rides `ctx.systemPrompt.section()` with a dynamic
 *            `text` thunk. dsh-system-prompt re-evaluates that thunk at every
 *            assembly (lib/index.js:342) and drops sections whose text is empty
 *            (lib/index.js:114), so the section behaves exactly like the
 *            upstream always-on hook while following the on/off switch with no
 *            restart and no re-registration.
 *   switch — `enabled` is a `.volatile()` Config field. The Loader hands the
 *            plugin a live reference whose `.get()` always returns the current
 *            value, so a Settings edit or a `/adhd on` takes effect on the very
 *            next assembly and persists in the profile's own patch layer.
 *   page   — the client half (client.js) renders a Settings page
 *            (`settings.section`) plus a compact pill next to the composer
 *            (`conversation.composer.dock`); both read and write this same
 *            volatile field through `ctx.configForms`.
 *
 * The upstream `/i-have-adhd` gesture is honoured too: because
 * `@deepseek-ai/dsh-tool-skill` is usually disabled, the pre-step listener
 * below watches user messages for the gesture itself.
 */
import { readFileSync } from 'node:fs';
import z from '@deepseek-ai/schemastery';

/** Cordis service name; also the loader row id and the settings namespace. */
export const name = 'i-have-adhd';

/** Settings namespace == the `cordis.patch.yml` row id == the ConfigForms entry id. */
export const NS = 'i-have-adhd';

/** `systemPrompt` is mandatory; `skills`, `settings`, `commands` are injected lazily below. */
export const inject = ['systemPrompt'];

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
  registerSkill: z
    .boolean()
    .default(true)
    .description('注册 i-have-adhd skill，使其出现在技能目录 / register the skill in the skill catalog'),
  honorStopPhrase: z
    .boolean()
    .default(true)
    .description('用户说 "stop adhd mode" 时自动关闭 / auto-disable when the user says "stop adhd mode"'),
});

// ---------------------------------------------------------------------------
// The ruleset itself
// ---------------------------------------------------------------------------

const SKILL_URL = new URL('./skills/i-have-adhd/SKILL.md', import.meta.url);

const SKILL_DESCRIPTION =
  'Shape output for a reader with ADHD: lead with the next action, number ' +
  'multi-step work, restate state across turns, suppress tangents, give ' +
  'specific time estimates, make wins visible.';

const SKILL_WHEN_TO_USE =
  'Use when the reader asked for ADHD-friendly output, or invoked /i-have-adhd.';

const ACTIVE_BANNER =
  'ADHD MODE ACTIVE. The ruleset below applies to every response. ' +
  'Say "stop adhd mode" to turn it off.';

/** Used only if the bundled SKILL.md cannot be read (kept backtick-free on purpose). */
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

function loadSkillBody() {
  try {
    const body = stripFrontmatter(readFileSync(SKILL_URL, 'utf8'));
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

// ---------------------------------------------------------------------------
// User-message scanning
// ---------------------------------------------------------------------------

const GESTURE_RE = /(^|\s)\/i-have-adhd(?=\s|$)/i;
const STOP_RES = [
  /stop\s+adhd(\s+mode)?/i,
  /normal\s+mode/i,
  /关闭\s*a?dhd/i,
  /正常模式/,
];

/** The text of the newest message actually authored by the user. */
function lastUserText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.source?.kind !== 'user') continue;
    const content = message.content;
    if (!Array.isArray(content)) continue;
    const text = content
      .filter((block) => block?.type === 'text')
      .map((block) => block.text ?? '')
      .join(' ')
      .trim();
    if (text.length > 0) return text;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function apply(ctx, config) {
  const options = config ?? {};
  const skillBody = loadSkillBody();

  const isEnabled = () => bool(options.enabled, false);

  // ---- 1. The hook: a dynamic system-prompt section ----------------------
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: NS,
        order: num(options.order, 15),
        text: () => (isEnabled() ? `${ACTIVE_BANNER}\n\n${skillBody}` : ''),
      }),
    'i-have-adhd: system-prompt hook',
  );

  // ---- 2. Publish the ruleset as a real skill ---------------------------
  if (bool(options.registerSkill, true)) {
    ctx.inject(['skills'], (skillCtx) => {
      skillCtx.effect(
        () =>
          skillCtx.skills.register({
            name: NS,
            description: SKILL_DESCRIPTION,
            whenToUse: SKILL_WHEN_TO_USE,
            content: skillBody,
            source: 'runtime',
            invocation: { modelInvocable: false, userInvocable: true },
          }),
        'i-have-adhd: skill registration',
      );
    });
  }

  // ---- 3. The switch: one writer, the /adhd command, the gesture --------
  ctx.inject(['settings', 'commands'], (actionCtx) => {
    const { settings, commands } = actionCtx;
    let lastError = '';

    /** The single write path, reachable from the UI through ctx.remote.commands.execute(). */
    const write = async (next) => {
      try {
        await settings.update(NS, { enabled: next });
        lastError = '';
        return true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        return false;
      }
    };

    actionCtx.effect(
      () =>
        commands.register({
          definitionId: 'i-have-adhd.adhd',
          name: 'adhd',
          description: 'Turn the ADHD output style on or off: /adhd on | off | toggle | status',
          handler: async (invocation) => {
            const argument = String(invocation.rawInput ?? '').trim().toLowerCase();
            const current = isEnabled();

            if (argument === '' || argument === 'status') {
              const suffix = lastError ? ` (last write failed: ${lastError})` : '';
              return {
                kind: 'success',
                text: `i-have-adhd: ${current ? 'ON' : 'OFF'}${suffix}`,
              };
            }

            let next;
            if (['on', 'enable', 'true', '开', '开启'].includes(argument)) next = true;
            else if (['off', 'disable', 'false', '关', '关闭'].includes(argument)) next = false;
            else if (['toggle', 'switch'].includes(argument)) next = !current;
            else {
              return {
                kind: 'error',
                text: `Unknown argument "${argument}". Use: /adhd on | off | toggle | status`,
              };
            }

            const ok = await write(next);
            return ok
              ? { kind: 'success', text: `i-have-adhd: ${next ? 'ON' : 'OFF'}` }
              : { kind: 'error', text: `Failed to update i-have-adhd config: ${lastError}` };
          },
        }),
      'i-have-adhd: /adhd command',
    );

    // The upstream /i-have-adhd gesture and the "stop adhd mode" phrase.
    actionCtx.effect(
      () =>
        actionCtx.on('agent/pre-step', async (payload, next) => {
          const decision = await next();
          const text = lastUserText(payload?.messages);
          if (text.length === 0) return decision;

          if (!isEnabled()) {
            if (GESTURE_RE.test(text)) await write(true);
            return decision;
          }
          if (bool(options.honorStopPhrase, true) && STOP_RES.some((re) => re.test(text))) {
            await write(false);
          }
          return decision;
        }),
      'i-have-adhd: gesture listener',
    );
  });
}

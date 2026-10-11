// Self-test for ../index.js (the Host half). Run: node test/host.mjs

import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// index.js imports @deepseek-ai/schemastery, which exists inside a DSH profile
// but not in a fresh clone. The hook substitutes a stub when the real package
// cannot be resolved, so this test runs anywhere.
register('./loader-hooks.mjs', import.meta.url);

const ENTRY = new URL('../index.js', import.meta.url).href;
const SOURCE = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const mod = await import(ENTRY);

const failures = [];
function check(label, cond, extra) {
  if (!cond) failures.push(label + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''));
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
}

// ---- module surface ------------------------------------------------------
check('name is adhd-mode', mod.name === 'adhd-mode', mod.name);
check('NS is adhd-mode', mod.NS === 'adhd-mode', mod.NS);
check(
  'inject is exactly [systemPrompt, agents]',
  JSON.stringify(mod.inject) === JSON.stringify(['systemPrompt', 'agents']),
  mod.inject,
);
check('Config schema exported', typeof mod.Config === 'function', typeof mod.Config);
check('apply exported', typeof mod.apply === 'function');

// ---- Config: the two fields the UI and the section rely on ---------------
{
  const defaults = mod.Config({});
  const enabled = defaults.enabled;
  const readable = enabled && typeof enabled.get === 'function' ? enabled.get() : enabled;
  check('Config resolves enabled to false by default', readable === false, enabled);
  check('Config resolves order to 15 by default', defaults.order === 15, defaults.order);
  check(
    'Config declares only enabled and order',
    Object.keys(defaults).sort().join(',') === 'enabled,order',
    Object.keys(defaults),
  );
}

// ---- the Host half owns no control surface -------------------------------
// The switch lives in the UI; nothing here parses what the reader typed, and
// nothing here writes config. These checks fail the moment any of that returns.
for (const [label, re] of [
  ['no /adhd command registration', /commands\.register/],
  ['no command definition at all', /definitionId/],
  ['no skill registration', /skills\.register/],
  ['no settings write path', /settings\.update/],
  ['no agent/pre-step listener', /agent\/pre-step/],
  ['no gesture matching', /GESTURE|adhd-mode gesture/],
  ['no stop-phrase matching', /honorStopPhrase|STOP_RES/],
  ['no lastUserText helper', /lastUserText/],
  ['no profile-wide prompt section', /\bctx\.systemPrompt\.section\(/],
]) {
  check(label, !re.test(SOURCE), re.source);
}
check('the banner advertises no phrase to say', !/stop adhd mode/i.test(SOURCE));

// ---- fake host ctx -------------------------------------------------------
// Deliberately minimal: if the plugin reaches for skills/settings/commands or
// any other service, `inject` records it and the check below fails. The ctx
// exposes the two services the plugin injects, and a global systemPrompt whose
// `section` records any profile-wide registration (which must never happen).
function fakeAgent(spec = {}) {
  const rec = { sections: [], disposed: 0 };
  const agent = {
    id: spec.id ?? 'agent',
    session: { header: { delegationDepth: 0, ...(spec.header ?? {}) } },
    options: spec.options ?? {},
    rec,
    ctx: {
      systemPrompt: {
        section(def) {
          rec.sections.push(def);
          return () => {
            rec.disposed += 1;
          };
        },
      },
    },
  };
  return agent;
}

function run(config, agents = [fakeAgent()]) {
  const rec = {
    agents,
    globalSections: [],
    labels: [],
    handlers: {},
    injections: [],
    cleanups: [],
  };
  const base = {
    effect(fn, label) {
      rec.labels.push(label);
      const dispose = fn();
      const cleanup = typeof dispose === 'function' ? dispose : () => {};
      rec.cleanups.push(cleanup);
      return cleanup;
    },
    systemPrompt: {
      section(def) {
        rec.globalSections.push(def);
        return () => {};
      },
    },
    agents: { list: () => rec.agents },
    on(event, handler) {
      rec.handlers[event] = handler;
      return () => {};
    },
    inject(deps, cb) {
      rec.injections.push(deps);
      cb({ effect: base.effect });
    },
  };
  let err = null;
  try {
    mod.apply(base, config);
  } catch (e) {
    err = e;
  }
  rec.err = err;
  return rec;
}

const sectionOf = (agent) => agent.rec.sections[0];

// ---- 1. disabled by default ---------------------------------------------
{
  const rec = run({});
  check('apply({}) did not throw', rec.err === null, rec.err && String(rec.err));
  check('asks for no other service', rec.injections.length === 0, rec.injections);
  check('registers nothing profile-wide', rec.globalSections.length === 0, rec.globalSections.length);
  check('exactly one section, on the top-level agent', rec.agents[0].rec.sections.length === 1, rec.agents[0].rec.sections.length);
  check('section name is the namespace', sectionOf(rec.agents[0]).name === 'adhd-mode', sectionOf(rec.agents[0]).name);
  check('section order is 15', sectionOf(rec.agents[0]).order === 15, sectionOf(rec.agents[0]).order);
  check('section text is "" while disabled', sectionOf(rec.agents[0]).text() === '', sectionOf(rec.agents[0]).text());
  check('section text is a function (re-evaluated per assembly)', typeof sectionOf(rec.agents[0]).text === 'function');
  check('one effect labelled', rec.labels.length === 1, rec.labels);
}

// ---- 2. enabled via plain value, ref value, and order override ----------
for (const [label, config] of [
  ['plain true', { enabled: true }],
  ['volatile ref', { enabled: { get: () => true } }],
  ['order override', { enabled: true, order: 42 }],
]) {
  const rec = run(config);
  const section = sectionOf(rec.agents[0]);
  const text = section.text();
  check('enabled (' + label + ') emits the ruleset', text.length > 500 && /Lead with the next action/.test(text), text.length);
  check('enabled (' + label + ') emits the banner', /ADHD MODE ACTIVE/.test(text), text.slice(0, 60));
  check('enabled (' + label + ') carries no frontmatter', !/^---/.test(text), text.slice(0, 20));
  check('enabled (' + label + ') carries the rule list', /## Rules/.test(text));
  if (config.order !== undefined) check('order override honoured', section.order === 42, section.order);
}

// ---- 3. the section text stays live after the config changes -----------
{
  const rec = run({ enabled: { get: () => false } });
  const text = sectionOf(rec.agents[0]).text;
  check('ref-based section is "" while off', text() === '');
  let on = true;
  const rec2 = run({ enabled: { get: () => on } });
  const text2 = sectionOf(rec2.agents[0]).text;
  check('ref-based section reads the ref on every call (on)', text2().length > 500);
  on = false;
  check('ref-based section reads the ref on every call (off)', text2() === '');
}

// ---- 4. delegated children never carry the ruleset ----------------------
{
  const child = fakeAgent({ id: 'child', header: { delegationDepth: 1 } });
  const rec = run({ enabled: true }, [fakeAgent({ id: 'root' }), child]);
  check('top-level agent still gets the section', rec.agents[0].rec.sections.length === 1);
  check('depth-1 child gets no section', child.rec.sections.length === 0, child.rec.sections.length);

  const originChild = fakeAgent({ id: 'child2', header: { origin: 'subagent' } });
  run({ enabled: true }, [originChild]);
  check('origin=subagent child gets no section', originChild.rec.sections.length === 0, originChild.rec.sections.length);

  const runtimeChild = fakeAgent({ id: 'child3', options: { subagentDepth: 2 } });
  run({ enabled: true }, [runtimeChild]);
  check('runtime subagentDepth child gets no section', runtimeChild.rec.sections.length === 0, runtimeChild.rec.sections.length);
}

// ---- 5. a fork is top-level, not a child -------------------------------
{
  const fork = fakeAgent({ id: 'fork', header: { parentSession: 'session-parent' } });
  run({ enabled: true }, [fork]);
  check('forked session (parentSession, depth 0) gets the section', fork.rec.sections.length === 1, fork.rec.sections.length);
}

// ---- 6. agents published after apply are picked up ---------------------
{
  const rec = run({ enabled: true }, []);
  const late = fakeAgent({ id: 'late' });
  const lateChild = fakeAgent({ id: 'late-child', header: { delegationDepth: 1 } });
  rec.handlers['agent/created']({ agent: late });
  rec.handlers['agent/created']({ agent: lateChild });
  check('agent/created installs on a new top-level agent', late.rec.sections.length === 1, late.rec.sections.length);
  check('agent/created skips a new child', lateChild.rec.sections.length === 0, lateChild.rec.sections.length);
  rec.handlers['agent/created']({ agent: late });
  check('a re-announced agent is not registered twice', late.rec.sections.length === 1, late.rec.sections.length);
}

// ---- 7. disposal ------------------------------------------------------
{
  const rec = run({ enabled: true });
  const agent = rec.agents[0];
  rec.handlers['agent/disposed']({ agent });
  check('agent/disposed disposes that agent section', agent.rec.disposed === 1, agent.rec.disposed);
  rec.cleanups[0]();
  check('plugin cleanup leaves nothing installed', rec.cleanups.length === 1);
}

console.log('\n' + (failures.length === 0 ? 'ALL CHECKS PASSED' : failures.length + ' CHECK(S) FAILED'));
if (failures.length) {
  failures.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}

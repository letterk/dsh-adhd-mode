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
check('inject is exactly [systemPrompt]', JSON.stringify(mod.inject) === JSON.stringify(['systemPrompt']), mod.inject);
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
]) {
  check(label, !re.test(SOURCE), re.source);
}
check('the banner advertises no phrase to say', !/stop adhd mode/i.test(SOURCE));

// ---- fake host ctx -------------------------------------------------------
// Deliberately minimal: if the plugin reaches for skills/settings/commands or
// any other service, `inject` records it and the check below fails.
function run(config) {
  const rec = { sections: [], labels: [], injections: [] };
  const base = {
    effect(fn, label) {
      rec.labels.push(label);
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    systemPrompt: {
      section(def) {
        rec.sections.push(def);
        return () => {};
      },
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

// ---- 1. disabled by default ---------------------------------------------
{
  const rec = run({});
  check('apply({}) did not throw', rec.err === null, rec.err && String(rec.err));
  check('asks for no other service', rec.injections.length === 0, rec.injections);
  check('exactly one prompt section', rec.sections.length === 1, rec.sections.length);
  check('section name is the namespace', rec.sections[0].name === 'adhd-mode', rec.sections[0].name);
  check('section order is 15', rec.sections[0].order === 15, rec.sections[0].order);
  check('section text is "" while disabled', rec.sections[0].text() === '', rec.sections[0].text());
  check('section text is a function (re-evaluated per assembly)', typeof rec.sections[0].text === 'function');
  check('one effect labelled', rec.labels.length === 1, rec.labels);
}

// ---- 2. enabled via plain value, ref value, and order override ----------
for (const [label, config] of [
  ['plain true', { enabled: true }],
  ['volatile ref', { enabled: { get: () => true } }],
  ['order override', { enabled: true, order: 42 }],
]) {
  const rec = run(config);
  const text = rec.sections[0].text();
  check('enabled (' + label + ') emits the ruleset', text.length > 500 && /Lead with the next action/.test(text), text.length);
  check('enabled (' + label + ') emits the banner', /ADHD MODE ACTIVE/.test(text), text.slice(0, 60));
  check('enabled (' + label + ') carries no frontmatter', !/^---/.test(text), text.slice(0, 20));
  check('enabled (' + label + ') carries the rule list', /## Rules/.test(text));
  if (config.order !== undefined) check('order override honoured', rec.sections[0].order === 42, rec.sections[0].order);
}

// ---- 3. the section text stays live after the config changes -----------
{
  const rec = run({ enabled: { get: () => false } });
  const text = rec.sections[0].text;
  check('ref-based section is "" while off', text() === '');
  let on = true;
  const rec2 = run({ enabled: { get: () => on } });
  const text2 = rec2.sections[0].text;
  check('ref-based section reads the ref on every call (on)', text2().length > 500);
  on = false;
  check('ref-based section reads the ref on every call (off)', text2() === '');
}

console.log('\n' + (failures.length === 0 ? 'ALL CHECKS PASSED' : failures.length + ' CHECK(S) FAILED'));
if (failures.length) {
  failures.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}

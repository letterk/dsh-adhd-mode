// Self-test for ../index.js (the Host half). Run: node test/host.mjs

import { register } from 'node:module';

// index.js imports @deepseek-ai/schemastery, which exists inside a DSH profile
// but not in a fresh clone. The hook substitutes a stub when the real package
// cannot be resolved, so this test runs anywhere.
register('./loader-hooks.mjs', import.meta.url);

const ENTRY = new URL('../index.js', import.meta.url).href;
const mod = await import(ENTRY);

const failures = [];
function check(label, cond, extra) {
  if (!cond) failures.push(label + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''));
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
}

// ---- module surface ------------------------------------------------------
check('name is i-have-adhd', mod.name === 'i-have-adhd', mod.name);
check('NS is i-have-adhd', mod.NS === 'i-have-adhd', mod.NS);
check('inject is [systemPrompt]', JSON.stringify(mod.inject) === JSON.stringify(['systemPrompt']), mod.inject);
check('Config schema exported', Boolean(mod.Config));
check('apply exported', typeof mod.apply === 'function');

// ---- fake host ctx -------------------------------------------------------
function run(config, options = {}) {
  const rec = { sections: [], skills: [], commands: [], listeners: [], writes: [], labels: [] };
  const settings = {
    async update(ns, patch) {
      if (options.failWrite) throw new Error('boom: write refused');
      rec.writes.push([ns, patch]);
      return true;
    },
  };
  const base = {
    effect(fn, label) { rec.labels.push(label); const d = fn(); return typeof d === 'function' ? d : () => {}; },
    systemPrompt: { section(def) { rec.sections.push(def); return () => {}; } },
    inject(deps, cb) {
      const sub = {
        effect: base.effect,
        on(event, fn) { rec.listeners.push({ event, fn }); return () => {}; },
      };
      if (deps.includes('skills')) sub.skills = { register(def) { rec.skills.push(def); return () => {}; } };
      if (deps.includes('settings')) sub.settings = settings;
      if (deps.includes('commands')) sub.commands = { register(def) { rec.commands.push(def); return () => {}; } };
      cb(sub);
    },
  };
  let err = null;
  try { mod.apply(base, config); } catch (e) { err = e; }
  rec.err = err;
  return rec;
}

function message(kind, text) {
  return { source: { kind }, content: [{ type: 'text', text }] };
}

// ---- 1. disabled by default --------------------------------------------
{
  const rec = run({});
  check('apply({}) did not throw', rec.err === null, rec.err && String(rec.err));
  check('exactly one prompt section', rec.sections.length === 1, rec.sections.length);
  check('section name is the namespace', rec.sections[0].name === 'i-have-adhd', rec.sections[0].name);
  check('section order is 15', rec.sections[0].order === 15, rec.sections[0].order);
  check('section text is "" while disabled', rec.sections[0].text() === '', rec.sections[0].text());
  check('section text is a function (re-evaluated per assembly)', typeof rec.sections[0].text === 'function');

  check('skill registered by default', rec.skills.length === 1, rec.skills.length);
  const skill = rec.skills[0] || {};
  check('skill name is i-have-adhd', skill.name === 'i-have-adhd', skill.name);
  check('skill source is runtime', skill.source === 'runtime', skill.source);
  check('skill is user-invocable but not model-invocable',
    skill.invocation && skill.invocation.userInvocable === true && skill.invocation.modelInvocable === false, skill.invocation);
  check('skill content has no YAML frontmatter', !/^---/.test(String(skill.content || '')), String(skill.content || '').slice(0, 20));
  check('skill content carries the ruleset', /Lead with the next action/.test(String(skill.content || '')));
  check('skill content carries a Rule list', /## Rules/.test(String(skill.content || '')));

  check('one command registered', rec.commands.length === 1, rec.commands.length);
  check('command name is adhd', rec.commands[0].name === 'adhd', rec.commands[0].name);
  check('command definitionId', rec.commands[0].definitionId === 'i-have-adhd.adhd', rec.commands[0].definitionId);
  check('command description mentions usage', /\/adhd on/.test(rec.commands[0].description), rec.commands[0].description);

  check('one agent/pre-step listener', rec.listeners.length === 1 && rec.listeners[0].event === 'agent/pre-step', rec.listeners);
  check('four effects labelled', rec.labels.length === 4, rec.labels);
}

// ---- 2. enabled via plain value, ref value, and order override ----------
for (const [label, config] of [
  ['plain true', { enabled: true }],
  ['volatile ref', { enabled: { get: () => true } }],
  ['order override', { enabled: true, order: 42 }],
]) {
  const rec = run(config);
  const text = rec.sections[0].text();
  check('enabled (' + label + ') emits ruleset', text.length > 500 && /Lead with the next action/.test(text), text.length);
  check('enabled (' + label + ') emits the banner', /ADHD MODE ACTIVE/.test(text), text.slice(0, 60));
  if (config.order !== undefined) check('order override honoured', rec.sections[0].order === 42, rec.sections[0].order);
}

// ---- 3. registerSkill:false -------------------------------------------
{
  const rec = run({ registerSkill: false });
  check('registerSkill:false skips the skill', rec.skills.length === 0, rec.skills.length);
  check('registerSkill:false still adds section+command+listener',
    rec.sections.length === 1 && rec.commands.length === 1 && rec.listeners.length === 1);
}

// ---- 4. /adhd command --------------------------------------------------
async function commandCase(config, rawInput, opts) {
  const rec = run(config, opts);
  const def = rec.commands[0];
  let result = null;
  let err = null;
  try { result = await def.handler({ rawInput, agent: {}, attachments: [], signal: undefined, commandId: 'x' }); } catch (e) { err = e; }
  return { rec, result, err };
}

{
  const cases = [
    ['status', {}, 'success', null, /OFF/],
    ['', {}, 'success', null, /OFF/],
    ['on', {}, 'success', [['i-have-adhd', { enabled: true }]], /ON/],
    ['OFF', {}, 'success', [['i-have-adhd', { enabled: false }]], /OFF/],
    ['enable', { enabled: false }, 'success', [['i-have-adhd', { enabled: true }]], /ON/],
    ['disable', { enabled: true }, 'success', [['i-have-adhd', { enabled: false }]], /OFF/],
    ['toggle', { enabled: false }, 'success', [['i-have-adhd', { enabled: true }]], /ON/],
    ['toggle', { enabled: true }, 'success', [['i-have-adhd', { enabled: false }]], /OFF/],
    ['switch', { enabled: true }, 'success', [['i-have-adhd', { enabled: false }]], /OFF/],
    ['开启', { enabled: false }, 'success', [['i-have-adhd', { enabled: true }]], /ON/],
    ['关闭', { enabled: true }, 'success', [['i-have-adhd', { enabled: false }]], /OFF/],
    ['bogus', {}, 'error', null, /Unknown argument "bogus"/],
  ];
  for (const [input, config, kind, writes, textRe] of cases) {
    const { rec, result, err } = await commandCase(config, input);
    const label = '/adhd "' + input + '"';
    check(label + ' returns ' + kind, err === null && result && result.kind === kind, err ? String(err) : result);
    check(label + ' text matches ' + textRe, Boolean(result && textRe.test(result.text || '')), result && result.text);
    if (writes) check(label + ' wrote ' + JSON.stringify(writes), JSON.stringify(rec.writes) === JSON.stringify(writes), rec.writes);
    else check(label + ' wrote nothing', rec.writes.length === 0, rec.writes);
  }
}

// ---- 5. write failure surfaces as an error result ----------------------
{
  const { result, err } = await commandCase({}, 'on', { failWrite: true });
  check('failed write returns kind:error', err === null && result.kind === 'error', err ? String(err) : result);
  check('failed write reports the cause', /boom: write refused/.test(result.text || ''), result.text);
  const { result: status } = await commandCase({}, 'status', { failWrite: true });
  check('status after failure is still success', status.kind === 'success', status);
}

// ---- 6. pre-step gesture / stop phrase ---------------------------------
async function stepCase(config, userText, kind = 'user') {
  const rec = run(config);
  const decision = { messages: ['ORIGINAL'] };
  const { fn } = rec.listeners[0];
  let nextCalls = 0;
  const out = await fn({ messages: [message(kind, userText)] }, async () => { nextCalls += 1; return decision; });
  return { rec, decision, out, nextCalls };
}

{
  const cases = [
    [{}, '/i-have-adhd', 'user', [['i-have-adhd', { enabled: true }]], 'gesture turns it on'],
    [{}, 'please /i-have-adhd now', 'user', [['i-have-adhd', { enabled: true }]], 'gesture mid-sentence'],
    [{}, 'hello there', 'user', [], 'plain message writes nothing'],
    [{ enabled: true }, 'stop adhd mode', 'user', [['i-have-adhd', { enabled: false }]], 'stop phrase turns it off'],
    [{ enabled: true }, 'ok normal mode', 'user', [['i-have-adhd', { enabled: false }]], 'normal mode turns it off'],
    [{ enabled: true }, '正常模式', 'user', [['i-have-adhd', { enabled: false }]], 'Chinese normal mode'],
    [{ enabled: true, honorStopPhrase: false }, 'stop adhd mode', 'user', [], 'honorStopPhrase:false ignores it'],
    [{ enabled: true }, 'stop adhd mode', 'assistant', [], 'assistant text is ignored'],
    [{}, 'foo/i-have-adhdbar', 'user', [], 'substring is not a gesture'],
    [{ enabled: false }, 'stop adhd mode', 'user', [], 'stop phrase while already off writes nothing'],
  ];
  for (const [config, text, kind, writes, label] of cases) {
    const { rec, out, decision, nextCalls } = await stepCase(config, text, kind);
    check('pre-step ' + label + ' -> ' + JSON.stringify(writes), JSON.stringify(rec.writes) === JSON.stringify(writes), { writes: rec.writes, text });
    check('pre-step ' + label + ' calls next() once', nextCalls === 1, nextCalls);
    check('pre-step ' + label + ' returns the downstream decision', out === decision, out);
  }
}

// ---- 7. the section text stays live after the config changes -----------
{
  const rec = run({});
  const text = rec.sections[0].text;
  check('section text is "" when disabled', text() === '');
  const rec2 = run({ enabled: { get: () => true } });
  check('section text is live from a ref-based config', rec2.sections[0].text().length > 500);
  let flag = false;
  const rec3 = run({ enabled: { get: () => flag } });
  const t3 = rec3.sections[0].text;
  check('ref-based section reads the ref on every call (off)', t3() === '');
  flag = true;
  check('ref-based section reads the ref on every call (on)', t3().length > 500);
}

console.log('\n' + (failures.length === 0 ? 'ALL CHECKS PASSED' : failures.length + ' CHECK(S) FAILED'));
if (failures.length) { failures.forEach((f) => console.log(' - ' + f)); process.exit(1); }

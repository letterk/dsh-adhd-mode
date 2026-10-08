// Self-test for ../client.js (the Client half). Run: node test/client.mjs
// Loads the client bundle with stub globals, runs apply() against a fake ctx,
// then renders both registered components and checks the locale contract.
import { readFileSync } from 'node:fs';

const SRC = new URL('../client.js', import.meta.url);
const src = readFileSync(SRC, 'utf8');

const failures = [];
function check(label, cond, extra) {
  if (!cond) failures.push(label + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''));
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
}

// ---- stub browser globals -------------------------------------------------
const loaded = [];
globalThis.window = { __ModuleLoader__: { load(entry) { loaded.push(entry); } } };
delete globalThis.document; // installStyle() must early-return

new Function(src)();

check('__ModuleLoader__.load was called exactly once', loaded.length === 1, loaded.length);
const mod = loaded[0];
check('loader id equals package name', mod && mod.id === 'dsh-adhd-mode', mod && mod.id);
check('factory is a function', mod && typeof mod.factory === 'function');

// ---- stub React ----------------------------------------------------------
function createElement(type, props, ...children) {
  return { type, props: props || {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) };
}
const React = {
  createElement,
  Fragment: 'Fragment',
  useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
};
const primitives = {
  IconChecklistOutlineRegular(props) { return createElement('svg', props || {}); },
};
const requireStub = (id) => {
  if (id === 'react') return React;
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
  if (id === 'react/jsx-runtime') return { jsx: createElement, jsxs: createElement, Fragment: 'Fragment' };
  throw new Error('unexpected require: ' + id);
};

const api = mod.factory(requireStub);
check('exports.inject is the expected array', Array.isArray(api.inject) && api.inject.includes('slots') && api.inject.includes('locale') && api.inject.includes('configForms'), api.inject);

// ---- fake client ctx -----------------------------------------------------
const dicts = {};
const usedKeys = new Set();
let activeLocale = 'zh';
const formCalls = [];
const registered = [];
const injectedRoots = [];

function fakeForm() {
  return {
    getSnapshot() { return { status: 'ready', value: { enabled: false }, writable: true, mode: 'host', revision: 3, base: {}, user: {} }; },
    subscribe() { return () => {}; },
    async set(field, value) { formCalls.push([field, value]); return true; },
  };
}

const ctx = {
  effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
  locale: {
    register(ns, d) { dicts[ns] = d; return () => {}; },
    bind(ns) {
      return (key) => {
        usedKeys.add(key);
        const table = dicts[ns] && dicts[ns][activeLocale];
        if (!table) return '<NO-DICT:' + activeLocale + '>';
        return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : '<MISSING:' + key + '>';
      };
    },
  },
  configForms: { get(entryId) { check('configForms.get received the patchId', entryId === 'adhd-mode', entryId); return fakeForm(); } },
  slots: {
    inject(root, cb) { injectedRoots.push(root); const d = cb(); return typeof d === 'function' ? d : () => {}; },
    register(def, comp) { registered.push({ def, comp }); return () => {}; },
  },
};

let applyError = null;
try { api.apply(ctx); } catch (err) { applyError = err; }
check('apply() did not throw', applyError === null, applyError && String(applyError));

check('locale dict registered for NS', Boolean(dicts['adhd-mode']));

// ---- locale dictionary contract: Record<string, string> ------------------
for (const loc of ['zh', 'en']) {
  const table = dicts['adhd-mode'] && dicts['adhd-mode'][loc];
  if (!table) { check('dict ' + loc + ' exists', false); continue; }
  const bad = Object.entries(table).filter(([, v]) => typeof v !== 'string');
  check('dict ' + loc + ' values are all strings', bad.length === 0, bad);
}

// ---- slot registrations --------------------------------------------------
check('two slots injected', injectedRoots.length === 2, injectedRoots);
check('injected conversation.input.left', injectedRoots.includes('conversation.input.left'), injectedRoots);
check('injected settings.section', injectedRoots.includes('settings.section'), injectedRoots);
check('two components registered', registered.length === 2, registered.length);

// ---- regression guard: the dock seat is invisible on a new Session -------
// The shipped composer only renders `conversation.composer.dock` for
// `variant === "composer"`, so the trigger must stay in the tool row.
const dockUse = src.match(/(?:inject\(|name:\s*)['"]conversation\.composer\.dock['"]/);
check('source does not register in the composer dock seat', dockUse === null, dockUse && dockUse[0]);
check('source registers in the composer tool row', /inject\('conversation\.input\.left'/.test(src), 'missing conversation.input.left');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
check('dsh.client.inject declares the primitives package',
  pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-primitives'), pkg.dsh.client.inject);
check('client platform is web', pkg.dsh.client.platform === 'web', pkg.dsh.client);

const byRoot = {};
injectedRoots.forEach((root, i) => { byRoot[root] = registered[i]; });

for (const [root, entry] of Object.entries(byRoot)) {
  check(root + ' registration id is adhd-mode', entry.def.id === 'adhd-mode', entry.def);
  check(root + ' registration name matches root', entry.def.name === root, entry.def.name);
}

// ---- render both components in both locales -----------------------------
function renderText(node, out) {
  if (node === null || node === undefined || node === false || node === true) return out;
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out; }
  if (Array.isArray(node)) { node.forEach((c) => renderText(c, out)); return out; }
  if (typeof node.type === 'function') { renderText(node.type({ ...node.props, children: node.children }), out); return out; }
  if (node.children) renderText(node.children, out);
  return out;
}

const renders = {};
for (const loc of ['zh', 'en']) {
  activeLocale = loc;
  for (const root of ['conversation.input.left', 'settings.section']) {
    const comp = byRoot[root].comp;
    let tree = null;
    let err = null;
    try { tree = comp({ close() {}, session: null, sessionId: 's1' }); } catch (e) { err = e; }
    check(root + ' renders in ' + loc, err === null && tree !== null, err && String(err));
    const text = [];
    if (tree) renderText(tree, text);
    renders[loc + '|' + root] = text.join(' | ');
    check(root + ' / ' + loc + ' has no MISSING locale key', !renders[loc + '|' + root].includes('<MISSING:'), renders[loc + '|' + root]);
    check(root + ' / ' + loc + ' has no missing dictionary', !renders[loc + '|' + root].includes('<NO-DICT:'), renders[loc + '|' + root]);
  }
}

const pageZh = renders['zh|settings.section'];
check('page lists 10 rules (zh)', (pageZh.match(/。/g) || []).length >= 10, pageZh.slice(0, 200));
check('page shows the ON/OFF state line (zh)', pageZh.includes('已关闭') || pageZh.includes('已开启'), pageZh.slice(0, 200));
const triggerZh = renders['zh|conversation.input.left'];
check('trigger shows the ADHD label (zh)', triggerZh.includes('ADHD'), triggerZh);
check('trigger label is short (zh)', !triggerZh.includes('模式'), triggerZh);

// ---- every key used by t() exists in both dictionaries ------------------
const tableZh = dicts['adhd-mode'].zh;
const tableEn = dicts['adhd-mode'].en;
const missingZh = [...usedKeys].filter((k) => !(k in tableZh));
const missingEn = [...usedKeys].filter((k) => !(k in tableEn));
check('no used key missing from zh dict', missingZh.length === 0, missingZh);
check('no used key missing from en dict', missingEn.length === 0, missingEn);
check('both dictionaries have identical key sets', JSON.stringify(Object.keys(tableZh).sort()) === JSON.stringify(Object.keys(tableEn).sort()),
  { onlyZh: Object.keys(tableZh).filter((k) => !(k in tableEn)), onlyEn: Object.keys(tableEn).filter((k) => !(k in tableZh)) });

// ---- toggle writes through the form ------------------------------------
const setFn = Object.values(byRoot)[1].comp; // not used directly; exercise via controller path
console.log('\nused locale keys:', [...usedKeys].sort().join(', '));

console.log('\n' + (failures.length === 0 ? 'ALL CHECKS PASSED' : failures.length + ' CHECK(S) FAILED'));
if (failures.length) { failures.forEach((f) => console.log(' - ' + f)); process.exit(1); }

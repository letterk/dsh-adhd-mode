// Module resolve hook for the Host self-test.
//
// index.js imports @deepseek-ai/schemastery. Inside a DSH profile that package
// is on disk, and the test should use it. A fresh clone has no node_modules, so
// the import fails and we fall back to the local stub instead of skipping the
// test.
//
// Set DSH_ADHD_MODE_STUB=1 to take the stub even when the real package is
// resolvable, which is how CI runs. Do that before pushing a change to the
// schema or to anything the stub stands in for.

const STUB = new URL('./schemastery-stub.mjs', import.meta.url).href;
const FORCE_STUB = process.env.DSH_ADHD_MODE_STUB === '1';

export async function resolve(specifier, context, nextResolve) {
  if (specifier !== '@deepseek-ai/schemastery') return nextResolve(specifier, context);
  if (FORCE_STUB) return { url: STUB, shortCircuit: true, format: 'module' };
  try {
    return await nextResolve(specifier, context);
  } catch {
    return { url: STUB, shortCircuit: true, format: 'module' };
  }
}

// Module resolve hook for the Host self-test.
//
// index.js imports @deepseek-ai/schemastery. Inside a DSH profile that package
// is on disk, and the test should use it. A fresh clone has no node_modules, so
// the import fails and we fall back to the local stub instead of skipping the
// test.

const STUB = new URL('./schemastery-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier !== '@deepseek-ai/schemastery') return nextResolve(specifier, context);
  try {
    return await nextResolve(specifier, context);
  } catch {
    return { url: STUB, shortCircuit: true, format: 'module' };
  }
}

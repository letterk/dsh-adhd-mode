// Stand-in for @deepseek-ai/schemastery, used only when the real package is not
// installed (fresh clone, CI). index.js builds its Config at import time, so the
// test needs something that answers the same builder calls. This reproduces the
// chainable shape, not the schema semantics: defaults, validation and the
// `.volatile()` metadata are the real package's job, not the test's.

function node(kind, fallback) {
  const schema = {
    kind,
    fallback,
    default(value) {
      schema.fallback = value;
      return schema;
    },
    description(text) {
      schema.text = text;
      return schema;
    },
    volatile() {
      schema.volatile = true;
      return schema;
    },
  };
  return schema;
}

const z = {
  object: (shape) => ({ kind: 'object', shape }),
  boolean: () => node('boolean', false),
  number: () => node('number', 0),
  string: () => node('string', ''),
};

export default z;

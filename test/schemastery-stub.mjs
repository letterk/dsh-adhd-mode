// Stand-in for @deepseek-ai/schemastery, used only when the real package is not
// installed (fresh clone, CI). index.js builds its Config at import time and the
// harness calls that schema to resolve a config, so the stub reproduces both
// halves: the chainable builder surface, and calling an object schema to get the
// defaults out.
//
// It is not a validator. Coercion, error reporting and the volatile-reference
// wiring are the real package's job, not the test's.

function node(kind, fallback) {
  const schema = (value) => (value === undefined ? schema.fallback : value);
  schema.kind = kind;
  schema.fallback = fallback;
  schema.resolve = () => schema.fallback;
  schema.default = (value) => {
    schema.fallback = value;
    return schema;
  };
  schema.description = (text) => {
    schema.text = text;
    return schema;
  };
  schema.volatile = () => {
    schema.isVolatile = true;
    return schema;
  };
  return schema;
}

function object(shape) {
  const schema = (value) => {
    const source = value ?? {};
    const resolved = {};
    for (const [key, field] of Object.entries(shape)) {
      resolved[key] = source[key] === undefined ? field.resolve() : source[key];
    }
    return resolved;
  };
  schema.kind = 'object';
  schema.shape = shape;
  schema.resolve = () => schema({});
  return schema;
}

const z = {
  object,
  boolean: () => node('boolean', false),
  number: () => node('number', 0),
  string: () => node('string', ''),
};

export default z;

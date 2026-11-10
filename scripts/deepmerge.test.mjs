import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const payload = () => JSON.parse('{"__proto__":{"injected":true}}');

function assertSafeTree(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(
    Object.getPrototypeOf(value),
    Array.isArray(value) ? Array.prototype : Object.prototype,
    "A merged object must not inherit an input-controlled prototype",
  );
  assert.equal(value.injected, undefined);
  assert.equal(Object.hasOwn(value, "__proto__"), false);
  for (const key of Reflect.ownKeys(value)) assertSafeTree(value[key]);
}

for (const consumer of [
  "@sveltejs/vite-plugin-svelte",
  "@rollup/plugin-node-resolve",
]) {
  const fromConsumer = createRequire(require.resolve(consumer));
  const entry = fromConsumer.resolve("deepmerge");
  const merge = fromConsumer("deepmerge");

  test(`${consumer}: returned prototypes stay safe across target shapes`, () => {
    const cases = [
      [Object.create(null), payload()],
      [payload(), {}],
      [payload(), payload()],
      [{ session: null }, { session: payload() }],
      [{ session: undefined }, { session: payload() }],
      [{ session: 0 }, { session: payload() }],
      [{ session: false }, { session: payload() }],
      [{ session: "placeholder" }, { session: payload() }],
      [{ session: payload() }, { session: {} }],
      [{ items: [payload()] }, { items: [payload()] }],
    ];
    for (const [target, source] of cases) assertSafeTree(merge(target, source));
    assertSafeTree(
      merge.all([payload(), { session: null }, { session: payload() }]),
    );
    assert.equal(Object.prototype.injected, undefined);
  });

  test(`${consumer}: normal merges preserve data, cloning, and symbols`, () => {
    const symbol = Symbol("config");
    const target = { nested: { keep: true }, items: [1] };
    const source = {
      nested: { added: true },
      items: [2],
      [symbol]: { enabled: true },
    };
    const result = merge(target, source);
    assert.deepEqual(result, {
      nested: { keep: true, added: true },
      items: [1, 2],
      [symbol]: { enabled: true },
    });
    assert.notEqual(result.nested, target.nested);
    assert.notEqual(result[symbol], source[symbol]);
    assert.deepEqual(target, { nested: { keep: true }, items: [1] });
    assert.deepEqual(source.items, [2]);
    assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }, { a: 3 }]), { a: 3, b: 2 });
  });

  test(`${consumer}: merge options remain compatible`, () => {
    assert.deepEqual(
      merge(
        { items: [1] },
        { items: [2] },
        { arrayMerge: (_target, source) => source },
      ),
      { items: [2] },
      "Svelte config arrays replace defaults",
    );
    assert.deepEqual(
      merge(
        { entry: { left: 1 } },
        { entry: { right: 2 } },
        {
          customMerge: (key) =>
            key === "entry"
              ? (a, b) => ({ ...a, ...b, combined: true })
              : undefined,
        },
      ),
      { entry: { left: 1, right: 2, combined: true } },
    );
    const nested = { value: 1 };
    assert.equal(merge({}, { nested }, { clone: false }).nested, nested);
    const date = new Date(0);
    assert.equal(merge({}, { date }).date, date);
    assert.deepEqual(merge({}, { pattern: /config/i }).pattern, /config/i);
  });

  test(`${consumer}: ESM consumers receive the same protected merge`, async () => {
    const imported = await import(pathToFileURL(entry).href);
    assert.equal(imported.default, merge);
    assertSafeTree(imported.default(Object.create(null), payload()));
  });
}

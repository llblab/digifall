import assert from "node:assert/strict";
import test from "node:test";

import { createLocalStorageStore, loadLocalStorageJson } from "./persistence.js";

function withLocalStorage(localStorage, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });
  try {
    return callback();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "localStorage", descriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
}

function withoutWarnings(callback) {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return callback();
  } finally {
    console.warn = warn;
  }
}

test("loadLocalStorageJson returns initial value when storage throws", () => {
  const localStorage = {
    getItem() {
      throw new Error("blocked");
    },
  };
  const result = withoutWarnings(() =>
    withLocalStorage(localStorage, () =>
      loadLocalStorageJson("options", { sound: true }),
    ),
  );
  assert.deepEqual(result, { sound: true });
});

test("createLocalStorageStore updates in memory when storage save throws", () => {
  const localStorage = {
    getItem() {
      return JSON.stringify({ value: 1 });
    },
    setItem() {
      throw new Error("quota exceeded");
    },
  };
  withoutWarnings(() =>
    withLocalStorage(localStorage, () => {
      const store = createLocalStorageStore("score", { value: 0 });
      store.set({ value: 2 });
      assert.deepEqual(store.get(), { value: 2 });
    }),
  );
});

test("createLocalStorageStore falls back on corrupt JSON", () => {
  const localStorage = {
    getItem() {
      return "{";
    },
    setItem() {},
  };
  const result = withoutWarnings(() =>
    withLocalStorage(localStorage, () => {
      const store = createLocalStorageStore("relays", { active: [] });
      return store.get();
    }),
  );
  assert.deepEqual(result, { active: [] });
});

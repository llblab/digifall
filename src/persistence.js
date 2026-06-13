import { get, writable } from "svelte/store";

export function loadLocalStorageJson(key, initialValue) {
  try {
    const saved = globalThis.localStorage?.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage`, error);
    return initialValue;
  }
}

function saveLocalStorageJson(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage`, error);
  }
}

export function createLocalStorageStore(
  key,
  initialValue,
  load = (initialValue) => loadLocalStorageJson(key, initialValue),
  save = (value) => saveLocalStorageJson(key, value),
) {
  let value = initialValue;
  try {
    value = load(initialValue) || initialValue;
  } catch (error) {
    console.warn(`Failed to initialize ${key}`, error);
  }
  const store = writable(value);
  return {
    get() {
      return get(store);
    },
    set(value) {
      try {
        save(value);
      } catch (error) {
        console.warn(`Failed to save ${key}`, error);
      }
      store.set(value);
    },
    update(cb) {
      this.set(cb(this.get()));
    },
    subscribe: store.subscribe,
  };
}

import { IDBDatastore } from "datastore-idb";

export async function createIndexedDBFactory(storeName) {
  const datastore = new IDBDatastore(storeName);
  await datastore.open().catch(() => {});
  return async function createIndexedDBStore(
    key,
    initialValue,
    load = async (initialValue) => {
      const stored = await datastore.get(key).catch(() => initialValue);
      if (stored === undefined && initialValue !== undefined) {
        await datastore.put(key, initialValue);
        return initialValue;
      }
      return stored;
    },
    save = async (value) => {
      await datastore.put(key, value).catch(() => {});
    },
  ) {
    const store = writable(await load(initialValue).catch(() => initialValue));
    return {
      get() {
        return get(store);
      },
      set(value) {
        save(value).then(() => store.set(value));
      },
      update(cb) {
        this.set(cb(this.get()));
      },
      subscribe: store.subscribe,
    };
  };
}

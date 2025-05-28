import { get, writable } from "svelte/store";

export function createLocalStorageStore(
  key,
  initialValue,
  load = (initialValue) => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  },
  save = (value) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
) {
  const store = writable(load(initialValue) || initialValue);
  return {
    get() {
      return get(store);
    },
    set(value) {
      save(value);
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

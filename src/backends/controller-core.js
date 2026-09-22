export function createBackendController({
  context = {},
  factories,
  setInteraction,
  setStatus,
}) {
  let activeBackend = null;
  let activeKind = null;
  let generation = 0;

  async function activate(kind, fallbackKind) {
    if (!factories[kind]) kind = fallbackKind;
    if (kind === activeKind && activeBackend) return activeBackend;

    const currentGeneration = ++generation;
    setInteraction(false);
    setStatus(kind, { state: "connecting" });

    const previous = activeBackend;
    activeBackend = null;
    activeKind = null;
    await previous?.stop?.();
    if (currentGeneration !== generation) return null;

    try {
      const backend = await factories[kind]();
      if (currentGeneration !== generation) {
        await backend.stop?.();
        return null;
      }
      activeBackend = backend;
      activeKind = kind;
      await backend.start?.({
        ...context,
        isCurrent: () => currentGeneration === generation,
        setInteraction: (value) => {
          if (currentGeneration === generation) setInteraction(value);
        },
        setStatus: (value) => {
          if (currentGeneration === generation) setStatus(kind, value);
        },
      });
      if (currentGeneration !== generation) {
        await backend.stop?.();
        return null;
      }
      return backend;
    } catch (error) {
      if (currentGeneration === generation) {
        setInteraction(false);
        setStatus(kind, {
          message: error instanceof Error ? error.message : String(error),
          state: "error",
        });
      }
      return null;
    }
  }

  function selectCard(index) {
    return activeBackend?.selectCard?.(index) ?? false;
  }

  async function stop() {
    ++generation;
    const previous = activeBackend;
    activeBackend = null;
    activeKind = null;
    setInteraction(false);
    await previous?.stop?.();
  }

  return { activate, selectCard, stop };
}

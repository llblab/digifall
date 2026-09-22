import { BACKENDS } from "../constants.js";
import {
  backendStatusStore,
  game,
  interactionStore,
} from "../stores.js";
import { createClassicBackend } from "./classic.js";
import { createBackendController } from "./controller-core.js";
import { clearGameView, projectChainGame } from "./view.js";

const DEFAULT_FACTORIES = {
  [BACKENDS.classic]: createClassicBackend,
  [BACKENDS.chain]: async () => {
    const { createChainBackend } = await import("./chain/index.js");
    return createChainBackend();
  },
};

export function createGameController(factories = DEFAULT_FACTORIES) {
  function setInteraction(value) {
    interactionStore.set(value);
    game.ready = value;
  }

  function setStatus(kind, value) {
    backendStatusStore.set({ kind, message: "", ...value });
  }

  const controller = createBackendController({
    context: {
      clearView: clearGameView,
      projectGame: projectChainGame,
    },
    factories,
    setInteraction,
    setStatus,
  });
  return {
    ...controller,
    activate: (kind = BACKENDS.classic) =>
      controller.activate(kind, BACKENDS.classic),
    selectCard(index) {
      if (!interactionStore.get()) return false;
      return controller.selectCard(index);
    },
  };
}

export const gameController = createGameController();

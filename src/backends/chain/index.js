import { CORE } from "../../constants.js";
import { validateChainGame } from "./validation.js";

function unavailableAdapter() {
  throw new Error("Polkadot API runtime adapter is not configured");
}

export function createChainBackend({
  createAdapter = unavailableAdapter,
  endpoint = "",
} = {}) {
  let adapter = null;
  let context = null;
  let readyGame = null;
  let stopped = true;
  let submitting = false;

  function isActive() {
    return !stopped && context?.isCurrent();
  }

  function projectGame(game) {
    if (!isActive()) return;
    try {
      validateChainGame(game);
      context.projectGame?.(game);
    } catch (error) {
      readyGame = null;
      context.setInteraction(false);
      context.setStatus({
        message: error instanceof Error ? error.message : String(error),
        state: "invalid-state",
      });
      return;
    }
    readyGame = game.status === "ready" ? game : null;
    context.setInteraction(Boolean(readyGame) && !submitting);
    context.setStatus({
      message: game?.message ?? "",
      state: game?.status ?? "connecting",
    });
  }

  return {
    kind: "chain",
    async start(nextContext) {
      context = nextContext;
      stopped = false;
      context.clearView?.();
      context.setInteraction(false);
      context.setStatus({ message: "", state: "connecting" });
      try {
        adapter = await createAdapter({ endpoint });
        if (!isActive()) {
          await adapter?.disconnect?.();
          adapter = null;
          return;
        }
        await adapter.connect({ onGame: projectGame });
      } catch (error) {
        if (!isActive()) return;
        const failedAdapter = adapter;
        adapter = null;
        await failedAdapter?.disconnect?.();
        context.setInteraction(false);
        context.setStatus({
          message: error instanceof Error ? error.message : String(error),
          state: "unavailable",
        });
      }
    },
    async stop() {
      stopped = true;
      readyGame = null;
      submitting = false;
      const previous = adapter;
      adapter = null;
      context = null;
      await previous?.disconnect?.();
    },
    async selectCard(cardIndex) {
      if (
        !isActive() ||
        !readyGame ||
        submitting ||
        !Number.isInteger(cardIndex) ||
        cardIndex < 0 ||
        cardIndex >= CORE.columns * CORE.rows
      )
        return false;
      submitting = true;
      context.setInteraction(false);
      context.setStatus({ message: "", state: "signing" });
      try {
        await adapter.submitMove({
          cardIndex,
          gameId: readyGame.gameId,
          revision: readyGame.revision,
        });
        if (isActive()) context.setStatus({ message: "", state: "in-pool" });
        return true;
      } catch (error) {
        if (isActive()) {
          context.setStatus({
            message: error instanceof Error ? error.message : String(error),
            state: "error",
          });
          context.setInteraction(Boolean(readyGame));
        }
        return false;
      } finally {
        submitting = false;
      }
    },
  };
}

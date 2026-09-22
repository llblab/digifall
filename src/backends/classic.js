import { PHASES } from "../constants.js";
import { phaseStore, plusIndexStore } from "../stores.js";
import { captureGameView, restoreGameView } from "./view.js";

let savedView = null;

export function createClassicBackend() {
  return {
    kind: "classic",
    start({ setInteraction, setStatus }) {
      restoreGameView(savedView);
      setInteraction(true);
      setStatus({ message: "", state: "ready" });
    },
    stop() {
      savedView = captureGameView();
    },
    selectCard(index) {
      if (phaseStore.get() !== PHASES.idle || plusIndexStore.get() !== null) {
        return false;
      }
      plusIndexStore.set(index);
      return true;
    },
  };
}

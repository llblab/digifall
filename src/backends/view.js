import { INITIAL_VALUES, PHASES } from "../constants.js";
import {
  cardsStore,
  energyStore,
  logStore,
  matchedIndexesStore,
  phaseStore,
  plusIndexStore,
  scoreStore,
} from "../stores.js";
import { normalizeChainGame } from "./chain/projection.js";

function copyCards(cards = []) {
  return cards.map((card) => ({ ...card }));
}

function copyRows(rows = []) {
  return rows.map((row) => ({ ...row }));
}

export function captureGameView() {
  return {
    cards: copyCards(cardsStore.get()),
    energy: { ...energyStore.get() },
    log: copyRows(logStore.get()),
    matchedIndexes: new Set(matchedIndexesStore.get()),
    phase: phaseStore.get(),
    plusIndex: plusIndexStore.get(),
    score: { ...scoreStore.get() },
  };
}

export function restoreGameView(view) {
  if (!view) return;
  cardsStore.set(copyCards(view.cards));
  energyStore.set({ ...view.energy });
  logStore.set(copyRows(view.log));
  matchedIndexesStore.set(new Set(view.matchedIndexes));
  phaseStore.set(view.phase);
  plusIndexStore.set(view.plusIndex);
  scoreStore.set({ ...view.score });
}

export function clearGameView() {
  restoreGameView({
    cards: INITIAL_VALUES.cards,
    energy: INITIAL_VALUES.energy,
    log: INITIAL_VALUES.log,
    matchedIndexes: INITIAL_VALUES.matchedIndexes,
    phase: PHASES.initial,
    plusIndex: INITIAL_VALUES.plusIndex,
    score: INITIAL_VALUES.score,
  });
}

export function projectChainGame(game) {
  const view = normalizeChainGame(game);
  if (!view) {
    clearGameView();
    return;
  }
  restoreGameView(view);
}

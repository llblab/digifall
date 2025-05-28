import { Howl } from "howler";

const { random, round } = Math;

/** @typedef {import('howler').Howl} HowlType */

/**
 * Collection of Howler sound objects used by the game.
 * newRecord is optional because the asset may be absent at runtime.
 * @typedef {Object} Sounds
 * @property {HowlType} bleep
 * @property {HowlType} blink
 * @property {HowlType} gameOver
 * @property {HowlType} generate
 * @property {HowlType} hit
 * @property {HowlType[]} kicks
 * @property {HowlType} lowEnergy
 * @property {HowlType} plus
 * @property {HowlType} slideIn
 * @property {HowlType} slideMove
 * @property {HowlType} slideOut
 * @property {HowlType} turnOn
 * @property {HowlType} wordUp
 * @property {HowlType} [newRecord]
 */

/** @type {number} */
const blinkRateInitial = 0.6;

/** @type {Sounds} */
const SOUNDS = {
  bleep: new Howl({
    src: "/sounds/bleep.wav",
  }),
  blink: new Howl({
    src: "/sounds/blink.wav",
    rate: blinkRateInitial,
  }),
  gameOver: new Howl({
    src: "/sounds/game-over.wav",
  }),
  generate: new Howl({
    src: "/sounds/generate.wav",
  }),
  hit: new Howl({
    src: "/sounds/hit.wav",
  }),
  kicks: [
    new Howl({
      src: "/sounds/kick-1.wav",
    }),
    new Howl({
      src: "/sounds/kick-2.wav",
    }),
  ],
  lowEnergy: new Howl({
    src: "/sounds/low-energy.wav",
  }),
  plus: new Howl({
    src: "/sounds/plus.wav",
  }),
  slideIn: new Howl({
    src: "/sounds/slide-in.wav",
  }),
  slideMove: new Howl({
    src: "/sounds/slide-move.wav",
  }),
  slideOut: new Howl({
    src: "/sounds/slide-out.wav",
  }),
  turnOn: new Howl({
    src: "/sounds/turn-on.wav",
  }),
  wordUp: new Howl({
    src: "/sounds/word-up.wav",
  }),
};

/** Plays a short confirmation tone. */
export function playBleep() {
  SOUNDS.bleep.play();
}

/**
 * Plays a sequence of blink sounds with incrementing rate.
 * @returns {void}
 */
export function playBlink() {
  const play = (rateDiff = 0.02) => {
    SOUNDS.blink.rate(SOUNDS.blink.rate() + rateDiff);
    SOUNDS.blink.play();
  };
  play();
  setTimeout(play, 200);
  setTimeout(() => play(0.04), 400);
}

/** Plays low energy alert. */
export function playLowEnergy() {
  SOUNDS.lowEnergy.play();
}

/** Plays plus sound. */
export function playPlus() {
  SOUNDS.plus.play();
}

/** Plays game over sound. */
export function playGameOver() {
  SOUNDS.gameOver.play();
}

/** Plays generation sound. */
export function playGenerate() {
  SOUNDS.generate.play();
}

/**
 * Plays hit sound with pitch depending on value.
 * @param {number} [value=0]
 */
export function playHit(value = 0) {
  SOUNDS.hit.rate(1 - (value ? value : 10) / 36);
  SOUNDS.hit.play();
}

/** Plays one of the kick sounds with slight rate randomization. */
export function playKick() {
  const kick = SOUNDS.kicks[round(random())];
  kick.rate(1 - (random() - 0.5) / 2);
  kick.play();
}

/** Plays new record sound if present. */
export function playNewRecord() {
  SOUNDS.newRecord.play();
}

/** Plays slide-in sound. */
export function playSlideIn() {
  SOUNDS.slideIn.play();
}

/**
 * Plays slide-move sound adjusting rate based on value.
 * @param {number} [value=0]
 */
export function playSlideMove(value = 0) {
  SOUNDS.slideMove.rate(1 + value / 27);
  SOUNDS.slideMove.play();
}

/** Plays slide-out sound. */
export function playSlideOut() {
  SOUNDS.slideOut.play();
}

/** Plays device turn-on sound with slight randomization. */
export function playTurnOn() {
  SOUNDS.turnOn.rate(1 - (random() - 0.5) / 10);
  SOUNDS.turnOn.play();
}

/** Plays word-up/combo sound. */
export function playWordUp() {
  SOUNDS.wordUp.play();
}

/** Resets runtime parameters for sounds (e.g., blink rate). */
export function reset() {
  SOUNDS.blink.rate(blinkRateInitial);
}

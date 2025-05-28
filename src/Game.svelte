<script>
  import Board from "./Board.svelte";
  import Energy from "./Energy.svelte";
  import Log from "./Log.svelte";
  import Score from "./Score.svelte";

  import { OVERLAYS } from "./constants.js";
  import { getRandom } from "./core.js";
  import {
    combosStore,
    logStore,
    optionsStore,
    overlayStore,
    seedStore,
  } from "./stores.js";

  let digifallElement = $state(null);
  let scoreComponent = $state(null);
  let boardComponent = $state(null);

  let screen = $derived($logStore.length > 0 || $combosStore.length > 0);

  $effect(() => {
    if (digifallElement) {
      digifallElement.isFocused = () =>
        digifallElement.classList.contains("focus");
      digifallElement.focus = () => digifallElement.classList.add("focus");
      digifallElement.blur = () => digifallElement.classList.remove("focus");
    }
  });

  export function moveUp() {
    digifallElement.isFocused()
      ? (digifallElement.blur(), boardComponent.shiftFocus({ y: 1 }))
      : scoreComponent.isFocused()
        ? (scoreComponent.blur(), digifallElement.focus())
        : boardComponent.shiftFocus({ y: 1 }).topEdge
          ? (boardComponent.blur({ savePrev: true }), scoreComponent.focus())
          : null;
  }

  export function moveDown() {
    digifallElement.isFocused()
      ? (digifallElement.blur(), scoreComponent.focus())
      : scoreComponent.isFocused()
        ? (scoreComponent.blur(), boardComponent.shiftFocus({ y: -1 }))
        : boardComponent.shiftFocus({ y: -1 }).bottomEdge
          ? (boardComponent.blur({ savePrev: true }), digifallElement.focus())
          : null;
  }

  export function moveLeft() {
    digifallElement.isFocused()
      ? null
      : scoreComponent.isFocused()
        ? scoreComponent.prevType()
        : boardComponent.shiftFocus({ x: -1 });
  }

  export function moveRight() {
    digifallElement.isFocused()
      ? null
      : scoreComponent.isFocused()
        ? scoreComponent.nextType()
        : boardComponent.shiftFocus({ x: 1 });
  }

  export function perfomAction() {
    digifallElement.isFocused()
      ? (digifallElement.click(),
        digifallElement.blur(),
        boardComponent.blur({ savePrev: true }))
      : scoreComponent.isFocused()
        ? scoreComponent.nextType()
        : boardComponent.plusFocusedCard();
  }

  export function blur() {
    digifallElement.blur();
    scoreComponent.blur();
    boardComponent.blur();
  }

  function getSeedgroundStyle(random) {
    if (!random) return;
    const getNextRandom = () => (random = getRandom(random));
    const getColor = (lightness = 13) => {
      return `hsl(${getNextRandom() % 360},50%,${lightness}%)`;
    };
    const arr = [
      2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
      71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149,
    ];
    let count = 4;
    const sizes = [];
    while (count--) {
      const [size] = arr.splice(getNextRandom() % arr.length, 1);
      sizes.push(size);
    }
    const [a, b, c, d] = sizes;
    return `
      background-color: var(--color-dark);
      background-image:
        linear-gradient(90deg, ${getColor()} 50%, transparent 50%),
        linear-gradient(90deg, ${getColor()} 50%, transparent 50%),
        linear-gradient(90deg, transparent 50%, ${getColor()} 50%),
        linear-gradient(90deg, transparent 50%, ${getColor()} 50%);
      background-size: ${a}rem, ${b}rem, ${c}rem, ${d}rem;`;
  }
</script>

<div class="game" class:blur={$overlayStore}>
  <div class="seedground" style={getSeedgroundStyle($seedStore)}></div>
  <div class="content">
    {#if $seedStore}
      <div class="section-1">
        <button
          class="digifall"
          class:screen
          title="[open menu]"
          onclick={() => ($overlayStore = OVERLAYS.menu)}
          bind:this={digifallElement}
        >
          <h1>
            digifall
            {#if $optionsStore.rapid}
              <span class="rapid">rapid</span>
            {/if}
          </h1>
          <Log />
        </button>
      </div>
      <div class="section-2">
        <Score bind:this={scoreComponent} />
      </div>
      <div class="section-3">
        <Board bind:this={boardComponent} />
      </div>
      <div class="section-4">
        <Energy />
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  :global .game {
    .seedground {
      position: absolute;
      width: 100vh;
      height: 100vw;
      background-blend-mode: difference;
      background-position: center;
      inset: 50%;
      transform: translate(-50%, -50%) rotate(90deg);
    }

    .content {
      background-color: var(--color-base);
      box-shadow:
        -1rem 0 0 0 var(--color-base),
        1rem 0 0 0 var(--color-base),
        0 0 3rem 2rem var(--color-black-04);
    }

    .digifall {
      display: flex;
      overflow: hidden;
      width: 100%;
      flex-grow: 1;
      align-items: center;
      justify-content: center;
      border: none;
      margin: auto;
      background-color: var(--color-dark);
      box-shadow: var(--shadow-inset), var(--gloss-inset);
      color: var(--color-0);
      font-size: inherit;
      font-weight: bold;
      outline-offset: -3px;
      text-shadow: var(--gloss), var(--shadow-1);

      &:active,
      &.screen {
        color: var(--color-dark);
      }

      &.focus,
      &:active,
      &.screen,
      &.screen.focus,
      &.screen:hover {
        background-color: var(--color-dark);
        text-shadow: var(--shadow-0);
      }
    }
  }
</style>

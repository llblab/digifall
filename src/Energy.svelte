<script>
  import { PHASES } from "./constants.js";
  import { playLowEnergy } from "./sounds.js";
  import { checkSound, energyStore, phaseStore } from "./stores.js";

  let { gameOver = false } = $props();

  let zeroFlipped = $state(false);

  let value = $derived($energyStore.value);
  let extra = $derived(value > 100);
  let warning = $derived(value < 20 && $phaseStore === PHASES.idle);

  let leftBarStyle = $derived(`
    z-index: ${extra ? 0 : 1};
    flex: ${(extra ? 200 - value : value) / 100};
  `);
  let leftValueStyle = $derived(`
    position: ${extra ? "absolute" : "relative"};
  `);
  let rightBarStyle = $derived(`
    z-index: ${extra ? 1 : 0};
    flex: ${extra ? (value - 100) / 100 : 0};
  `);
  let rightValueStyle = $derived(`
    position: ${extra ? "relative" : "absolute"};
    left: ${
      extra ? `calc(${value > 119 ? 0 : (value - 120) / 100} * 128rem)` : 0
    };
  `);

  $effect(() => {
    if (warning) checkSound(playLowEnergy);
  });

  $effect(() => {
    if (gameOver && !zeroFlipped) {
      setTimeout(() => (zeroFlipped = true));
    }
  });
</script>

<div class="energy">
  <div class="left-bar" class:warning style={leftBarStyle}>
    <span class="left-value" class:warning style={leftValueStyle}>
      {value}
    </span>
  </div>
  <div class="right-bar" class:extra style={rightBarStyle}>
    <span
      class="right-value"
      class:warning
      class:flip={zeroFlipped}
      style={rightValueStyle}
    >
      <span class="front">{value}</span>
      {#if gameOver}
        <span class="back">O</span>
      {/if}
    </span>
  </div>
  {#if gameOver}
    <span class="energy-out">
      {#each "ut of energy" as letter, index}
        <span
          class={letter === " " ? "space" : "letter"}
          style:animation-delay="{400 + index * 100}ms"
        >
          {letter}
        </span>
      {/each}
    </span>
  {/if}
</div>

<style lang="postcss">
  :global .energy {
    position: relative;
    display: flex;
    width: 100%;
    height: 9rem;
    background-color: var(--color-dark);
    box-shadow: var(--shadow-inset), var(--gloss-inset);
    font-size: 7rem;
    letter-spacing: 0;
    text-indent: 1rem;

    .left-bar,
    .right-bar {
      overflow: hidden;
      padding: 1rem 0;
      box-shadow: var(--gloss), var(--shadow-1);
    }

    .left-bar {
      background-color: white;
      text-align: right;

      .left-value {
        right: 0;
        color: var(--color-dark);
        transition: color 200ms ease;
      }
    }

    .right-bar {
      &.extra {
        background-color: var(--color-random);
      }

      .right-value {
        width: 7rem;
        height: 7rem;
        backface-visibility: hidden;
        color: white;
        transform-style: preserve-3d;
        transition: transform 800ms ease-in-out;

        &.flip {
          transform: rotateY(180deg);
        }

        .front,
        .back {
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          color: white;
        }

        .back {
          position: absolute;
          top: 0;
          transform: rotateY(180deg);
        }
      }
    }

    .energy-out {
      position: absolute;
      width: 100%;
      height: 7rem;
      padding-top: 3rem;
      padding-left: 9rem;
      color: white;
      font-size: 5rem;
      font-weight: bold;
      letter-spacing: 1rem;
      text-indent: 0;

      .letter,
      .space {
        display: inline-block;
        width: 7rem;
        padding-left: 1rem;
        animation: flip 400ms ease-in-out forwards;
        opacity: 0;
        perspective: 128rem;
        transform-style: preserve-3d;
      }
    }

    .warning {
      animation: flick 2s infinite;
    }
  }

  @keyframes flick {
    20%,
    25%,
    30%,
    35% {
      opacity: 1;
    }

    21%,
    24%,
    31%,
    34% {
      opacity: 0;
    }
  }

  @keyframes flip {
    0% {
      opacity: 1;
      transform: rotateY(90deg);
    }
    100% {
      opacity: 1;
      transform: rotateY(0);
    }
  }
</style>

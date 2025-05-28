<script>
  import { blur, fly } from "svelte/transition";

  import Energy from "./Energy.svelte";
  import Score from "./Score.svelte";

  import { KEYS, OVERLAYS } from "./constants.js";
  import game, {
    energyStore,
    optionsStore,
    overlayStore,
    recordsStore,
    resetGame,
    scoreStore,
  } from "./stores.js";

  let { scoreComponent = $bindable(null) } = $props();

  let energyOut = $derived($energyStore.value === 0);
  let gameOver = $derived(energyOut && $energyStore.buffer === 0);
  let highCombo = $derived($recordsStore[KEYS.highCombo][KEYS.value]);
  let newRecordHighCombo = $derived(
    gameOver && highCombo > game[KEYS.highComboPrev],
  );
  let newRecordHighScore = $derived(
    gameOver && $scoreStore.value > game[KEYS.highScorePrev],
  );
  let newRecord = $derived(newRecordHighCombo || newRecordHighScore);

  function startNewGame() {
    resetGame();
  }

  function showLeaderboard() {
    overlayStore.set(OVERLAYS.leaderboard);
  }

  function showOptions() {
    overlayStore.set(OVERLAYS.options);
  }
</script>

<div class="game-over content" class:new-record={newRecord} in:blur>
  <div class="section-1">
    {#if gameOver}
      <h1 in:fly|global={{ delay: 600, y: -48 }}>
        {newRecord ? "new record!" : "game over"}
      </h1>
    {/if}
  </div>
  <div class="section-2">
    <Score
      {newRecordHighCombo}
      {newRecordHighScore}
      {newRecord}
      overlaid
      bind:this={scoreComponent}
    />
  </div>
  <div class="section-3">
    {#if gameOver}
      <div class="col" in:fly|global={{ delay: 600, y: 24 }}>
        <button onclick={startNewGame}>new game</button>
        {#if $optionsStore[KEYS.leaderboard]}
          <button onclick={showLeaderboard}>p2p leaderboard</button>
        {/if}
        <button onclick={showOptions}>options</button>
      </div>
    {/if}
  </div>
  <div class="section-4">
    <Energy {gameOver} />
  </div>
</div>

<style lang="postcss">
  :global .game-over {
    &.new-record {
      h1,
      .score {
        color: var(--color-random);
      }

      .score:active {
        text-shadow: 0 0 1px var(--color-random);
      }
    }

    .score:active {
      color: var(--color-invis-2);
      text-shadow: var(--glow);
    }

    .energy {
      background-color: transparent;
      box-shadow: none;

      .left-bar .left-value {
        color: black;
      }
    }
  }

  @keyframes scale-in {
    from {
      transform: scale(0);
    }

    to {
      transform: scale(1);
    }
  }
</style>

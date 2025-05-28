<script>
  import { blur as blurTransition } from "svelte/transition";

  import { KEYS, PHASES } from "./constants.js";
  import { phaseStore, recordsStore, scoreStore } from "./stores.js";

  const TYPES = {
    [KEYS.highCombo]: "hi-combo",
    [KEYS.highScore]: "hi-score",
    [KEYS.score]: "score",
  };

  let { newRecordHighCombo, newRecordHighScore, newRecord, overlaid } =
    $props();

  let type = $state(KEYS.score);
  let timeoutId = $state(null);
  let visible = $state(false);
  let focused = $state(false);

  let value = $derived(
    type === KEYS.score ? $scoreStore.value : $recordsStore[type][KEYS.value],
  );
  let title = $derived(
    "score: " +
      value +
      "\nhigh score: " +
      $recordsStore[KEYS.highScore][KEYS.value] +
      "\nhigh combo: " +
      $recordsStore[KEYS.highCombo][KEYS.value],
  );

  $effect(() => {
    if (newRecord) {
      type = newRecordHighScore ? KEYS.highScore : KEYS.highCombo;
      visible = true;
    }
  });

  export function isFocused() {
    return focused;
  }

  export function focus() {
    focused = true;
  }

  export function blur() {
    focused = false;
  }

  export function nextType(event) {
    event.preventDefault();
    type = getNextType(type);
    animateNewType();
  }

  export function prevType() {
    type = getNextType(type, true);
    animateNewType();
  }

  function getNextType(type, reverse = false) {
    if (newRecord)
      return {
        [KEYS.highScore]: newRecordHighCombo ? KEYS.highCombo : KEYS.highScore,
        [KEYS.highCombo]: newRecordHighScore ? KEYS.highScore : KEYS.highCombo,
      }[type];
    if (reverse)
      return {
        [KEYS.score]: KEYS.highCombo,
        [KEYS.highScore]: KEYS.score,
        [KEYS.highCombo]: KEYS.highScore,
      }[type];
    return {
      [KEYS.score]: KEYS.highScore,
      [KEYS.highScore]: KEYS.highCombo,
      [KEYS.highCombo]: KEYS.score,
    }[type];
  }

  function animateNewType() {
    visible = true;
    clearTimeout(timeoutId);
    if (newRecord) return;
    timeoutId = setTimeout(() => {
      type = KEYS.score;
      visible = newRecord;
    }, 3200);
  }
</script>

{#key type}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <span
    class="score"
    class:focus={focused}
    {title}
    tabindex="0"
    role="button"
    in:blurTransition
    onclick={nextType}
  >
    <span class="type" class:visible>{TYPES[type]}:</span>
    {#if overlaid || $phaseStore !== PHASES.gameOver}
      <span class="value">{value}</span>
    {/if}
  </span>
{/key}

<style lang="postcss">
  :global .score {
    display: flex;
    align-items: baseline;
    padding: 3rem;
    padding-left: 3.5rem;
    cursor: pointer;
    white-space: nowrap;

    &.focus,
    &:active {
      text-shadow: var(--shadow-0);
    }

    &:active {
      color: var(--color-base);
    }

    &:not(:active).focus {
      box-shadow:
        1px 1px var(--color-dark),
        1px -1px var(--color-dark),
        -1px -1px var(--color-dark),
        -1px 1px var(--color-dark);
      outline-offset: -1px;
    }

    &.focus .type,
    &:hover .type,
    .type.visible {
      display: inline;
    }

    .type {
      display: none;
    }

    .value {
      width: 100%;
      font-size: 6.5rem;
      font-weight: bold;
      text-align: right;
    }
  }
</style>

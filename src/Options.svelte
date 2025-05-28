<script>
  import { blur, fly } from "svelte/transition";

  import Dialog from "./Dialog.svelte";
  import PlayerName from "./PlayerName.svelte";

  import { INITIAL_VALUES, OVERLAYS } from "./constants.js";
  import {
    optionsStore,
    overlayStore,
    recordsStore,
    resetGame,
  } from "./stores.js";

  let dialogComponent = $state(null);
  let dialogVisible = $state(false);

  let playerNameComponent = $state(null);
  let playerName = $derived($optionsStore.playerName);

  export function isDialogVisible() {
    return dialogVisible;
  }

  function accept() {
    dialogComponent.close();
    $recordsStore = INITIAL_VALUES.records;
    resetGame(playerName);
  }

  function reject() {
    dialogComponent.close();
    playerName = $optionsStore.playerName;
  }

  function goToMenu() {
    if (playerName === "") {
      return playerNameComponent.blink();
    }
    if (playerName !== $optionsStore.playerName) {
      return dialogComponent.open();
    }
    $overlayStore = OVERLAYS.menu;
  }

  function openRelays() {
    $overlayStore = OVERLAYS.relays;
  }
</script>

{#if !dialogVisible}
  <div class="options content" in:blur|global>
    <div class="section-1">
      <span in:fly|global={{ y: -48 }}>options</span>
    </div>
    <div class="section-2"></div>
    <div class="section-3" in:fly|global={{ y: 24 }}>
      <div class="col">
        <PlayerName bind:this={playerNameComponent} bind:value={playerName} />
        <input type="checkbox" id="rapid" bind:checked={$optionsStore.rapid} />
        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <label
          for="rapid"
          title="boring animations {$optionsStore.rapid
            ? 'disabled'
            : 'enabled'}"
          tabindex="0"
          role="button">rapid mode</label
        >
        <input
          type="checkbox"
          id="sound"
          checked={$optionsStore.sound}
          onclick={() => ($optionsStore.sound = !$optionsStore.sound)}
        />
        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <label
          for="sound"
          title="making sounds {$optionsStore.sound ? 'enabled' : 'disabled'}"
          tabindex="0"
          role="button">sound effects</label
        >
        <input
          type="checkbox"
          id="leaderboard"
          bind:checked={$optionsStore.leaderboard}
        />
        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <label
          for="leaderboard"
          title="sharing records {$optionsStore.leaderboard
            ? 'enabled'
            : 'disabled'}"
          tabindex="0"
          role="button"
        >
          p2p leaderboard
        </label>
        <button
          class="suboption"
          disabled={!$optionsStore.leaderboard}
          onclick={openRelays}
          in:fly|global={{ x: 20 }}
        >
          relays
        </button>
      </div>
    </div>
    <div class="section-4">
      <div class="col">
        <button
          onclick={goToMenu}
          title="[open menu]"
          in:fly|global={{ y: 48 }}
        >
          menu
        </button>
      </div>
    </div>
  </div>
{/if}

<Dialog
  title={playerName}
  bind:this={dialogComponent}
  bind:visible={dialogVisible}
>
  <div class="col exclam-fix">
    <p>new name detected!</p>
    <p>progress will be lost!</p>
    <div class="row">
      <button onclick={accept}>accept</button>
      <button onclick={reject}>reject</button>
    </div>
  </div>
</Dialog>

<style lang="postcss">
  button.suboption {
    max-width: fit-content;
    padding-right: 1rem;
    padding-left: 1rem;
    margin-left: 1rem;
  }

  input[type="checkbox"] {
    display: none;
    appearance: none;
  }

  input[type="checkbox"] + label {
    cursor: pointer;
    line-height: 6rem;
    text-indent: 0;
  }

  input[type="checkbox"] + label::before,
  input[type="checkbox"]:checked + label::after {
    position: absolute;
    top: 0;
    bottom: 0;
    margin: auto;
    content: "";
  }

  input[type="checkbox"] + label::before {
    right: 4rem;
    width: 2.5rem;
    height: 2.5rem;
    border: 1rem solid currentcolor;
  }

  input[type="checkbox"]:checked + label::after {
    right: 5.3rem;
    width: 1.5rem;
    height: 1.5rem;
    background-color: greenyellow;
    box-shadow: var(--shadow-inset);
  }

  input[type="checkbox"]:disabled + label {
    color: var(--color-0);
    cursor: not-allowed;
  }
</style>

<script>
  import { blur } from "svelte/transition";

  import Dialog from "./Dialog.svelte";
  import PlayerName from "./PlayerName.svelte";

  import { optionsStore, overlayStore, timestampStore } from "./stores.js";

  let dialogComponent = $derived(null);
  let dialogVisible = $derived(true);

  let playerNameComponent = $derived(null);
  let playerName = $derived($optionsStore.playerName);

  function input() {
    if (playerName === $optionsStore.playerName) return;
    $optionsStore.playerName = playerName;
    $timestampStore = Date.now();
  }

  function submit(event) {
    event.preventDefault();
    if (playerName === "") return playerNameComponent.blink();
    $overlayStore = null;
  }
</script>

{#if !dialogVisible}
  <form
    class="wellcome content"
    in:blur|global
    oninput={input}
    onsubmit={submit}
  >
    <div class="section-1">
      <h1>digifall</h1>
    </div>
    <div class="section-2"></div>
    <div class="section-3">
      <div class="col">
        <PlayerName bind:this={playerNameComponent} bind:value={playerName} />
        <button type="submit">start</button>
      </div>
    </div>
    <div class="section-4"></div>
  </form>
{/if}

<Dialog
  title="heads up!"
  bind:this={dialogComponent}
  bind:visible={dialogVisible}
>
  <div class="col">
    <p>Game doesn't contain tutorial mode!</p>
    <p>Target: understand how to play it</p>
    <button onclick={dialogComponent.close}>continue</button>
  </div>
</Dialog>

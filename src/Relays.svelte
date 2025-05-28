<script>
  import { DEFAULT_RELAYS } from "@digifall/leaderboard";
  import { blur, fly } from "svelte/transition";

  import { OVERLAYS } from "./constants.js";
  import { activeRelaysStore, overlayStore, relaysStore } from "./stores.js";
  import { sanitizeMultiaddr, validateMultiaddr } from "./validation.js";

  let values = $state([...$activeRelaysStore]);
  let newValue = $state("");

  const getError = (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "";
    return validateMultiaddr(trimmed) ? "" : "invalid multiaddr";
  };

  let errors = $derived(values.map(getError));
  let newError = $derived(getError(newValue));

  $effect(() => {
    values = [...$activeRelaysStore];
  });

  function updateActiveRelays(fn) {
    relaysStore.update((state) => ({
      ...state,
      active: fn(state.active),
    }));
  }

  function resetRelays() {
    relaysStore.set({
      active: [...DEFAULT_RELAYS],
      applied: [...DEFAULT_RELAYS],
    });
  }

  function oninput(event, index) {
    const sanitized = sanitizeMultiaddr(event.target.value);
    event.target.value = sanitized;
    values[index] = sanitized;
  }

  function oninputNew(event) {
    const sanitized = sanitizeMultiaddr(event.target.value);
    event.target.value = sanitized;
    newValue = sanitized;
  }

  function saveRelay(index) {
    const value = values[index].trim();
    if (!value) {
      updateActiveRelays((relays) => relays.filter((_, i) => i !== index));
      return;
    }
    if (errors[index]) return;
    const validated = validateMultiaddr(value);
    if (validated !== $activeRelaysStore[index]) {
      updateActiveRelays((relays) =>
        relays.map((r, i) => (i === index ? validated : r)),
      );
    }
  }

  function addRelay() {
    const value = newValue.trim();
    if (!value || newError) return;
    const validated = validateMultiaddr(value);
    updateActiveRelays((relays) => [...relays, validated]);
    newValue = "";
  }

  function removeRelay(index) {
    updateActiveRelays((relays) => relays.filter((_, i) => i !== index));
  }

  export function saveCurrentRelay() {
    const focused = document.activeElement;
    if (focused?.tagName !== "TEXTAREA") return;
    const row = focused.closest(".relay-row");
    const rows = Array.from(document.querySelectorAll(".relays .relay-row"));
    const index = rows.indexOf(row);
    if (index === -1) return;
    if (index === rows.length - 1) {
      addRelay();
    } else {
      saveRelay(index);
    }
  }

  function goBack() {
    $overlayStore = OVERLAYS.options;
  }
</script>

<div class="relays content" in:blur|global>
  <div class="section-1">
    <span in:fly|global={{ y: -48 }}>relays</span>
  </div>
  <div class="section-2"></div>
  <div class="section-3" in:fly|global={{ y: 24 }}>
    <div class="col">
      <div class="list">
        {#each values as value, index}
          <div class="relay-row">
            <div class="textarea-wrap">
              <textarea
                class:error={errors[index]}
                class:valid={!errors[index] && value.trim()}
                {value}
                oninput={(e) => oninput(e, index)}
                onblur={() => saveRelay(index)}
                rows="3"
              ></textarea>
              {#if errors[index]}
                <span class="error-msg">{errors[index]}</span>
              {/if}
            </div>
            <button
              class="remove-btn"
              title="remove"
              onclick={() => removeRelay(index)}
            >
              <span class="icon-remove">+</span>
            </button>
          </div>
        {/each}
        <div class="relay-row new-row">
          <div class="textarea-wrap">
            <textarea
              class:error={newError}
              class:valid={!newError && newValue.trim()}
              value={newValue}
              oninput={oninputNew}
              placeholder="/dns4/example.com/tcp/443/wss/p2p/12D3KooW..."
              rows="3"
            ></textarea>
            {#if newError}
              <span class="error-msg">{newError}</span>
            {/if}
          </div>
          <button class="add-btn" title="add relay" onclick={addRelay}>+</button
          >
        </div>
      </div>
    </div>
  </div>
  <div class="section-4">
    <div class="row">
      <button
        onclick={resetRelays}
        title="[reset relays]"
        in:fly|global={{ y: 48 }}
      >
        reset
      </button>
      <button onclick={goBack} title="[options]" in:fly|global={{ y: 48 }}>
        back
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  .list {
    display: flex;
    overflow: hidden scroll;
    height: 100%;
    max-height: 128rem;
    flex-direction: column;
    padding: 4rem 1rem;
    gap: 4rem;
  }

  .relay-row {
    display: flex;
    width: 100%;
    gap: 1rem;
  }

  .textarea-wrap {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  textarea {
    width: 100%;
    min-height: 6rem;
    padding: 1rem 3rem;
    border: 0.75rem solid white;
    backdrop-filter: blur(1rem);
    background-color: var(--color-black-04);
    color: inherit;
    font-family: inherit;
    font-size: 3rem;
    letter-spacing: 0;
    line-height: 1.75;
    outline: none;
    outline-offset: 1px;
    resize: none;
    word-break: break-all;
  }

  textarea:focus.valid {
    border-color: var(--color-1);
  }

  textarea.error {
    border-color: var(--color-3);
  }

  .error-msg {
    position: absolute;
    right: 2rem;
    bottom: calc(1rem - 1px);
    overflow: hidden;
    padding: 1rem 0;
    backdrop-filter: blur(1rem);
    background-color: var(--color-black-04);
    color: var(--color-3);
    font-size: 2rem;
    pointer-events: none;
  }

  .remove-btn,
  .add-btn {
    display: flex;
    max-width: 9rem;
    height: auto;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-size: 4rem;
    line-height: 1;
  }

  .icon-remove {
    display: block;
    rotate: 45deg;
  }

  .section-4 {
    .row {
      gap: 4rem;
    }
  }
</style>

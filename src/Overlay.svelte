<script>
  import { tick } from "svelte";
  import { fade } from "svelte/transition";

  import GameOver from "./GameOver.svelte";
  import Leaderboard from "./Leaderboard.svelte";
  import Menu from "./Menu.svelte";
  import Options from "./Options.svelte";
  import Relays from "./Relays.svelte";
  import Wellcome from "./Wellcome.svelte";

  import { OVERLAYS, PHASES } from "./constants.js";
  import { overlayStore, phaseStore } from "./stores.js";

  let leaderboardComponent = $state(null);
  let menuComponent = $state(null);
  let optionsComponent = $state(null);
  let relaysComponent = $state(null);
  let scoreComponent = $state(null);
  let focusElement = $state(null);

  export async function switchOverlay() {
    await tick();
    if (menuComponent && menuComponent.isNewGameDialog()) {
      return menuComponent.closeNewGameDialog();
    }
    $overlayStore =
      currentOverlay === null ||
      currentOverlay === OVERLAYS.leaderboard ||
      currentOverlay === OVERLAYS.options ||
      currentOverlay === OVERLAYS.relays
        ? OVERLAYS.menu
        : null;
  }

  export function moveUp() {
    if ($overlayStore === OVERLAYS.relays) {
      if (isTextareaEditing()) return;
      return shiftFocusRelays(-2); // skip by 2 (textarea + button per row)
    }
    shiftFocus(-1);
  }

  export function moveDown() {
    if ($overlayStore === OVERLAYS.relays) {
      if (isTextareaEditing()) return;
      return shiftFocusRelays(2); // skip by 2 (textarea + button per row)
    }
    shiftFocus(1);
  }

  export function moveLeft() {
    if ($overlayStore === OVERLAYS.relays) {
      if (isTextareaEditing()) return;
      return shiftFocusRelays(-1); // move to textarea
    }
    if ($overlayStore === OVERLAYS.leaderboard) {
      if (!focusElement) return;
      return focusElement.classList.contains("types")
        ? focusElement.click()
        : leaderboardComponent.prevPage(
            focusElement.classList.contains("pages"),
          );
    }
    if (
      $overlayStore !== OVERLAYS.options ||
      optionsComponent.isDialogVisible()
    )
      shiftFocus(-1);
  }

  export function moveRight() {
    if ($overlayStore === OVERLAYS.relays) {
      if (isTextareaEditing()) return;
      return shiftFocusRelays(1); // move to button
    }
    if ($overlayStore === OVERLAYS.leaderboard) {
      if (!focusElement) return;
      return focusElement.classList.contains("types")
        ? focusElement.click()
        : leaderboardComponent.nextPage(
            focusElement.classList.contains("pages"),
          );
    }
    if (
      $overlayStore !== OVERLAYS.options ||
      optionsComponent.isDialogVisible()
    )
      shiftFocus(-1);
  }

  export function perfomAction() {
    if (
      $overlayStore === OVERLAYS.relays &&
      focusElement?.tagName === "TEXTAREA"
    ) {
      if (isTextareaEditing()) {
        // Already editing: save, blur, return to visual focus mode
        relaysComponent?.saveCurrentRelay();
        focusElement.blur();
      } else {
        // Enter edit mode: real focus
        focusElement.focus();
      }
      return;
    }
    if (!focusElement) return;
    scoreComponent && scoreComponent.isFocused()
      ? scoreComponent.nextType()
      : focusElement.classList.contains("focus")
        ? focusElement.click()
        : null;
  }

  export function blur() {
    if (focusElement) {
      focusElement.blur();
    }
    if (
      $overlayStore === OVERLAYS.options ||
      $overlayStore === OVERLAYS.leaderboard ||
      $overlayStore === OVERLAYS.gameOver
    ) {
      return overlayStore.set(OVERLAYS.menu);
    }
    if ($overlayStore === OVERLAYS.relays) {
      return overlayStore.set(OVERLAYS.options);
    }
    if ($overlayStore === OVERLAYS.menu && $phaseStore !== PHASES.gameOver) {
      return overlayStore.set(null);
    }
  }

  function findElement({ node, selectors, shift = 0 } = {}) {
    if (!selectors || selectors.length < 1) return;
    const selector = selectors.map((s) => ".overlay " + s).join(", ");
    const elements = Array.from(document.querySelectorAll(selector));
    if (!node)
      return shift < 0 ? elements[elements.length + shift] : elements[0];
    if (shift === 0) return node;
    const index = elements.indexOf(node);
    if (index === -1)
      return shift < 0 ? elements[elements.length + shift] : elements[0];
    let newIndex = index + shift;
    if (newIndex < 0) newIndex = elements.length + newIndex;
    if (newIndex > elements.length - 1) newIndex = newIndex - elements.length;
    return elements[newIndex];
  }

  function focus(element, skipRealFocus = false) {
    if (!element) return;
    if (scoreComponent && scoreComponent.isFocused()) scoreComponent.blur();
    if (focusElement) {
      focusElement.classList.remove("focus");
      focusElement.blur();
    }
    if (element.classList.contains("score")) {
      return scoreComponent && scoreComponent.focus();
    }
    focusElement = element;
    focusElement.classList.add("focus");
    if (!skipRealFocus) {
      focusElement.focus();
    }
  }

  function isTextareaEditing() {
    return (
      focusElement?.tagName === "TEXTAREA" &&
      document.activeElement === focusElement
    );
  }

  function shiftFocus(shift) {
    const selectors = [
      "button:not(.digifall)",
      "[role='button']",
      "input:not([type='checkbox'])",
      "[tabindex='-1']",
    ];
    const selector = selectors
      .map((s) => ".overlay " + s + ".focus")
      .join(", ");
    const node = document.querySelector(selector);
    const element = findElement({ node, selectors, shift });
    focus(element);
  }

  function shiftFocusRelays(shift) {
    const selectors = ["textarea", "button:not(.digifall)"];
    const selector = selectors
      .map((s) => ".overlay " + s + ".focus")
      .join(", ");
    const node = document.querySelector(selector);
    const element = findElement({ node, selectors, shift });
    const skipRealFocus = element?.tagName === "TEXTAREA";
    focus(element, skipRealFocus);
  }
</script>

{#if $overlayStore}
  <div class="overlay" transition:fade={{ duration: 200 }}>
    {#if $overlayStore === OVERLAYS.gameOver}
      <GameOver bind:scoreComponent />
    {:else if $overlayStore === OVERLAYS.leaderboard}
      <Leaderboard bind:this={leaderboardComponent} />
    {:else if $overlayStore === OVERLAYS.menu}
      <Menu bind:this={menuComponent} />
    {:else if $overlayStore === OVERLAYS.options}
      <Options bind:this={optionsComponent} />
    {:else if $overlayStore === OVERLAYS.relays}
      <Relays bind:this={relaysComponent} />
    {:else if $overlayStore === OVERLAYS.wellcome}
      <Wellcome />
    {/if}
  </div>
{/if}

<style lang="postcss">
  :global .overlay {
    position: fixed;
    z-index: 3;
    width: 100%;
    background-color: var(--color-black-08);

    button {
      height: 9rem;
      padding: 0;
      border: 1rem solid white;
      margin: 6rem 0;
      box-shadow: var(--shadow-2);

      &:active {
        border: 0.75rem solid white;
        letter-spacing: 1.1rem;
      }
    }

    .section-4 button {
      margin: 0;
    }
  }
</style>

<script>
  import Game from "./Game.svelte";
  import Overlay from "./Overlay.svelte";

  import { OVERLAYS, PHASES, RELOAD_IN_SEC } from "./constants.js";
  import {
    energyStore,
    overlayStore,
    phaseStore,
    seedStore,
  } from "./stores.js";

  let gameComponent = $state(null);
  let overlayComponent = $state(null);

  $effect(() => {
    if (RELOAD_IN_SEC > 0) {
      setTimeout(() => (location = location), RELOAD_IN_SEC * 1e3);
    }
  });

  $effect(() => {
    if ($phaseStore !== PHASES.gameOver) return;
    $overlayStore = OVERLAYS.gameOver;
  });

  $effect(() => {
    document.documentElement.classList[
      $energyStore.value > 100 ||
      $phaseStore === PHASES.extra ||
      $phaseStore === PHASES.combo ||
      $overlayStore === OVERLAYS.leaderboard ||
      $overlayStore === OVERLAYS.gameOver
        ? "add"
        : "remove"
    ]("random-color");
  });

  function onkeydown(event) {
    const component = $overlayStore === null ? gameComponent : overlayComponent;
    switch (event.code) {
      case "Escape":
        event.preventDefault();
        return component.blur();
      case "Tab":
        event.preventDefault();
        if (!$seedStore) return;
        if ($overlayStore === OVERLAYS.wellcome) return;
        if ($overlayStore === OVERLAYS.gameOver) return;
        return overlayComponent.switchOverlay();
      case "ArrowUp":
        return component.moveUp();
      case "ArrowDown":
        return component.moveDown();
      case "ArrowLeft":
        return component.moveLeft();
      case "ArrowRight":
        return component.moveRight();
      case "Enter":
      case "Space":
        event.preventDefault();
        return component.perfomAction();
      case "KeyF":
      case "KeyJ":
        return component.perfomAction();
    }
  }

  function syncTabs() {
    if (document.hasFocus()) return;
    document.location = document.location;
  }

  function updateRem() {
    const { style, offsetHeight, offsetWidth } = document.documentElement;
    const ratio = offsetHeight / offsetWidth;
    const landscape = ratio < 1.5;
    const size = landscape ? offsetHeight / 192 : offsetWidth / 128;
    const diff = size % 0.25;
    style.setProperty("font-size", size - diff + "px");
  }
</script>

<svelte:window
  {onkeydown}
  onstorage={syncTabs}
  onresize={updateRem}
  onvisibilitychange={updateRem}
  use:updateRem
/>

<div class="app">
  <Game bind:this={gameComponent} />
  <Overlay bind:this={overlayComponent} />
</div>

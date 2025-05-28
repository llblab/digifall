<script>
  import { sanitizePlayerName } from "./validation.js";

  let { value = $bindable("") } = $props();

  let inputElement = $state(null);
  let visibility = $state("hidden");

  let title = $derived("player name: " + value.toUpperCase());

  $effect(() => {
    if (value === "") inputElement?.focus();
  });

  function oninput(event) {
    const original = event.target.value;
    const sanitized = sanitizePlayerName(original);
    visibility = original === sanitized ? "hidden" : "visible";
    event.target.value = sanitized;
    value = sanitized;
  }

  export function blink(duration = 400) {
    visibility = "hidden";
    if (!inputElement) return;
    inputElement.classList.toggle("blink");
    setTimeout(() => inputElement.classList.toggle("blink"), duration);
  }
</script>

<span class="symbols" style:visibility>a-z 0-9 @&$!?-+=.:/_</span>
<input
  class="player-name"
  type="text"
  inputmode="url"
  placeholder="player name"
  spellcheck="false"
  maxlength="42"
  {title}
  bind:this={inputElement}
  {value}
  {oninput}
/>

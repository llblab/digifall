<script>
  import { blur, fly } from "svelte/transition";

  let { title = "", visible = $bindable(false), children } = $props();

  export function open() {
    visible = true;
  }

  export function close() {
    visible = false;
  }
</script>

{#if visible}
  <div class="dialog content" in:blur>
    <div class="section-1">
      {#if title}
        <span class="title" in:fly={{ y: -48 }}>
          {title}
        </span>
      {/if}
    </div>
    <div class="section-2"></div>
    <div class="section-3" in:fly={{ y: 24 }}>
      {@render children({ visible, open, close })}
    </div>
    <div class="section-4"></div>
  </div>
{/if}

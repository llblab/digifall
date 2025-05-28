<script>
  /**
   * @template T
   * @typedef {Object} Props
   * @property {T[]} items
   * @property {number} [bufferSize]
   * @property {number} [startIndex]
   * @property {number} [endIndex]
   * @property {import('svelte').Snippet<[T, number]>} children
   * @property {(item: T, index: number) => string | number} [keyFn]
   */

  /** @type {Props<T>} */
  let {
    items,
    bufferSize = 16,
    startIndex = $bindable(0),
    endIndex = $bindable(0),
    children,
    keyFn = (item, index) => (item, index),
  } = $props();

  let rootElement = /** @type {HTMLDivElement | null} */ ($state.raw(null));
  let rootHeight = $state.raw(0);
  let itemHeight = $state.raw(0);
  let scrollTop = $state.raw(0);

  let fromIndex = $derived(Math.max(0, startIndex - bufferSize));
  let toIndex = $derived(Math.min(endIndex + bufferSize, items.length));
  let visibleItems = $derived(items.slice(fromIndex, toIndex));
  let contentTopOffset = $derived(fromIndex * itemHeight);
  let totalHeight = $derived(items.length * itemHeight);

  $effect(() => {
    if (!itemHeight) return;
    startIndex = Math.floor(scrollTop / itemHeight);
    endIndex = startIndex + Math.ceil(rootHeight / itemHeight);
  });

  /** @type {(event: UIEvent) => void} */
  function onscroll(event) {
    scrollTop = event.target.scrollTop;
  }

  /** @type {(index: number, smooth?: boolean) => void} */
  export function scrollToIndex(index, smooth = false) {
    if (index < 0 || index >= items.length) return;
    requestAnimationFrame(() => {
      rootElement?.scrollTo({
        top: index * itemHeight,
        behavior: smooth ? "smooth" : "instant",
      });
    });
  }
</script>

<div
  class="virtual-scroll"
  bind:this={rootElement}
  bind:offsetHeight={rootHeight}
  {onscroll}
>
  <div
    class="virtual-list"
    style:height="{totalHeight}px"
    style:padding-top="{contentTopOffset}px"
  >
    {#each visibleItems as item, index (keyFn(item, fromIndex + index))}
      <div class="virtual-item" bind:offsetHeight={itemHeight}>
        {@render children?.(item, fromIndex + index)}
      </div>
    {/each}
  </div>
</div>

<style lang="postcss">
  .virtual-scroll {
    overflow: hidden auto;
    width: 100%;
    height: 100%;
  }

  .virtual-item {
    width: 100%;
  }
</style>

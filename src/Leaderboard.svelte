<script>
  import { compare } from "@digifall/leaderboard";
  import { blur, fly } from "svelte/transition";

  import VirtualScroll from "./VirtualScroll.svelte";

  import { KEYS, MAX_RECORDS, OVERLAYS } from "./constants.js";
  import { leaderboardStores, throttle } from "./leaderboard.js";
  import { optionsStore, overlayStore } from "./stores.js";

  const PAGE_SIZE = 100;
  const PAGE_COUNTS = Math.ceil(MAX_RECORDS / PAGE_SIZE) + 1;

  let page = $state(0);
  let type = $state(KEYS.highScore);
  let startIndex = $state(0);
  let endIndex = $state(0);
  let virtualScrollComponent = $state(null);

  let leaderboardStore = $derived(leaderboardStores[type]);
  let sorted = $derived(
    $leaderboardStore
      .slice()
      .sort((a, b) => compare(b, a))
      .slice(0, MAX_RECORDS),
  );
  let mapped = $derived([
    ...sorted.map((item, index) => ({
      place: index === 999 ? 0 : index + 1,
      ...item,
    })),
    ...Array.from({ length: MAX_RECORDS - sorted.length }).map(
      (_, index, array) => ({
        place: index === array.length - 1 ? 0 : index + sorted.length + 1,
        playerName: "",
        value: 0,
      }),
    ),
  ]);

  let selfIndex = $derived(
    sorted.findIndex(
      ({ playerName }) => playerName === $optionsStore[KEYS.playerName],
    ),
  );
  let scrollToIndexThrottled = $derived(
    virtualScrollComponent
      ? throttle(virtualScrollComponent.scrollToIndex, 250)
      : () => {},
  );

  $effect(() => {
    updatePage(endIndex);
  });

  $effect(() => {
    scrollToSelf();
  });

  function switchType(_event) {
    type = type === KEYS.highScore ? KEYS.highCombo : KEYS.highScore;
  }

  export function prevPage(value) {
    if (value) {
      page = page < 1 ? PAGE_COUNTS - 1 : page - 1;
      virtualScrollComponent.scrollToIndex(Math.max(page * PAGE_SIZE - 1, 0));
      return page;
    }
    scrollToIndexThrottled(Math.max(startIndex - 8, 0), true);
  }

  export function nextPage(value) {
    if (value) {
      page = page < PAGE_COUNTS - 1 ? page + 1 : 0;
      virtualScrollComponent.scrollToIndex(Math.max(page * PAGE_SIZE - 1, 0));
      return page;
    }
    scrollToIndexThrottled(Math.min(startIndex + 8, MAX_RECORDS - 1), true);
  }

  function selectPage(event) {
    const item = event
      .composedPath()
      .find(({ dataset }) => dataset && dataset.index);
    if (item === undefined) return;
    page = Number(item.dataset.index);
    const index =
      page === 0
        ? 0
        : page === 10
          ? MAX_RECORDS - 1
          : item.dataset.index * 100 - 1;
    virtualScrollComponent.scrollToIndex(index);
  }

  function showMenu() {
    $overlayStore = OVERLAYS.menu;
  }

  function updatePage(endIndex) {
    if (endIndex >= MAX_RECORDS - 2) return (page = 10);
    return (page = getPlaceColor(endIndex));
  }

  function getPlaceColor(place) {
    if (place > 0 && place < MAX_RECORDS * 0.1) return 0;
    if (place >= 100 && place < MAX_RECORDS * 0.2) return 1;
    if (place >= 200 && place < MAX_RECORDS * 0.3) return 2;
    if (place >= 300 && place < MAX_RECORDS * 0.4) return 3;
    if (place >= 400 && place < MAX_RECORDS * 0.5) return 4;
    if (place >= 500 && place < MAX_RECORDS * 0.6) return 5;
    if (place >= 600 && place < MAX_RECORDS * 0.7) return 6;
    if (place >= 700 && place < MAX_RECORDS * 0.8) return 7;
    if (place >= 800 && place < MAX_RECORDS * 0.9) return 8;
    if (place >= 900 && place < MAX_RECORDS) return 9;
    return 0;
  }

  function formatPlace(place) {
    if (place === 0 && selfIndex === -1) return "???";
    return (
      Array.from({ length: 3 - place?.toString().length })
        .map(() => "0")
        .join("") + place
    );
  }

  function formatPlayerName(playerName, place) {
    if (place === 0 && selfIndex === -1) return $optionsStore[KEYS.playerName];
    return playerName;
  }

  function scrollToSelf() {
    virtualScrollComponent.scrollToIndex(
      selfIndex === -1 ? MAX_RECORDS - 1 : Math.max(selfIndex - 7, 0),
    );
  }
</script>

<div class="leaderboard content" in:blur>
  <div class="section-1">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="types"
      title="[switch leaderboard]"
      tabindex="0"
      role="button"
      in:fly|global={{ y: -48 }}
      onclick={switchType}
    >
      <span class="type" class:active={type === KEYS.highCombo}>combos</span>
      <span class="high">high &gt;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;</span
      >
      <span class="type" class:active={type === KEYS.highScore}>scores</span>
    </div>
  </div>
  <div class="section-2">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
    <ul
      class="pages"
      title="[select page]"
      tabindex="0"
      role="button"
      onclick={selectPage}
    >
      {#each Array.from({ length: PAGE_COUNTS }) as _, index}
        {@const value = index > 9 ? 0 : index}
        <li
          class="page"
          class:active={index === page}
          style:--color="var(--color-{value})"
          data-index={index}
        >
          {value}
        </li>
      {/each}
    </ul>
  </div>
  <div class="section-3 board" tabindex="-1">
    <VirtualScroll
      items={mapped}
      bind:startIndex
      bind:endIndex
      bind:this={virtualScrollComponent}
    >
      {#snippet children({ place, playerName, value })}
        {@const self = playerName === $optionsStore[KEYS.playerName]}
        {@const title =
          "place: " +
          place +
          "\nname: " +
          playerName?.toUpperCase() +
          "\nscore: " +
          value}
        <div
          class={[
            "grid",
            {
              first: place === 1,
              second: place === 2,
              third: place === 3,
            },
          ]}
          {title}
        >
          <div class="place" style:color="var(--color-{getPlaceColor(place)})">
            {formatPlace(place)}
          </div>
          <div class="player-name" class:self>
            {formatPlayerName(playerName, place)}
          </div>
          <div class="bar" class:self></div>
          <div class="record" class:self>{value}</div>
        </div>
      {/snippet}
    </VirtualScroll>
  </div>
  <div class="section-4">
    <div class="col">
      <button title="[open menu]" onclick={showMenu} in:fly={{ y: 48 }}>
        menu
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  :global .leaderboard .virtual-list {
    margin: 4rem 0 12rem;
  }

  .types {
    position: relative;
    display: flex;
    height: 100%;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    cursor: pointer;

    &:active .high,
    &:active .active {
      color: var(--color-invis-1);
      text-shadow: 0 0 1px white;
    }

    &:active .type:not(.active) {
      color: var(--color-invis-1);
      text-shadow: 0 0 1px var(--color-dark);
    }
  }

  .high {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 19rem;
    height: fit-content;
    margin: auto;
  }

  .type {
    position: relative;
    right: 25rem;
    color: white;
    transition: top 200ms ease-in-out;

    &.active:first-child {
      top: 2.5rem;
    }

    &:not(.active):first-child {
      top: -5rem;
      color: var(--color-dark);
    }

    &.active:last-child {
      top: -2.5rem;
    }

    &:not(.active):last-child {
      top: 6rem;
      color: var(--color-dark);
    }
  }

  .pages {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    font-size: 4rem;
  }

  .page {
    display: flex;
    width: 12rem;
    height: 12rem;
    align-items: center;
    justify-content: center;
    border: 1rem solid transparent;
    color: var(--color);
    cursor: pointer;
    font-weight: bold;

    &.active {
      border-color: var(--color);

      &:active {
        border-color: var(--color-invis-2);
        box-shadow:
          0 0 1px var(--color),
          inset 0 0 1px var(--color);
      }
    }

    &:active {
      color: var(--color-invis-2);
      text-shadow: 0 0 1px var(--color);
    }
  }

  .board {
    padding-left: 1rem;
    margin: 0;
    background-color: transparent;
    box-shadow: none;
    font-size: 4rem;
    letter-spacing: 0.5rem;
    list-style: none;

    &::before,
    &::after {
      display: none;
    }
  }

  .grid {
    display: grid;
    height: 14rem;
    padding: 2rem 0;
    grid-template: "a b b" auto "a c d" auto / 18rem 1fr auto;

    &.first {
      zoom: 1.18;
    }

    &.second {
      zoom: 1.12;
    }

    &.third {
      zoom: 1.06;
    }
  }

  .place {
    display: grid;
    align-items: center;
    padding-top: 2rem;
    color: var(--color-0);
    grid-area: a;
    text-shadow: var(--gloss);
  }

  .player-name {
    overflow: hidden;
    height: 1em;
    justify-content: flex-start;
    margin-bottom: 1rem;
    grid-area: b;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar {
    height: 4rem;
    flex-grow: 1;
    border-top: 0.75rem solid white;
    border-right: 0.75rem solid white;
    margin-right: 2rem;
    grid-area: c;

    &.self {
      border-color: var(--color-random);
    }
  }

  .record {
    height: 4rem;
    justify-content: flex-end;
    margin-right: 1rem;
    grid-area: d;
    text-align: right;
    text-indent: 0;

    &.self::before {
      border-color: currentcolor;
      color: inherit;
    }
  }

  .self {
    color: var(--color-random);
  }
</style>

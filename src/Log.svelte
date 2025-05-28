<script>
  import { fade, slide } from "svelte/transition";

  import { PHASES } from "./constants.js";
  import {
    checkRapid,
    combosStore,
    logStore,
    phaseStore,
    scoreStore,
  } from "./stores.js";

  function getCountsStyle(digits = []) {
    let { length } = digits;
    if (length < 1) return "";
    if (length > 4) length = 4;
    return digits.reduce(
      (result, digit, index) => {
        return result + `--clr-${index + 1}: var(--color-${digit});`;
      },
      `animation: colors-${length} ${
        200 + 200 * length
      }ms steps(2, end) infinite;`,
    );
  }
</script>

<ol class="log">
  {#if $phaseStore !== PHASES.score}
    {#each $logStore as { digits, counts, extra, sum, ...row }, logIndex}
      {@const rowKeys = Object.keys(row)}
      <li
        class="row"
        in:slide={checkRapid({ duration: 100 })}
        out:fade={checkRapid({ duration: 200 })}
      >
        <span>{logIndex + 1}</span>
        <span>[</span>
        {#each rowKeys as key, rowIndex}
          <span class="value" style:color="var(--color-{key})">{row[key]}</span>
          {#if rowIndex < rowKeys.length - 1}
            <span class="plus">+</span>
          {/if}
        {/each}
        {#if extra === undefined}
          <span>]</span>
          {#if counts > 1}
            <span class="counts" style={getCountsStyle(digits)}>{counts}</span>
          {/if}
          <span>=</span>
          <span class="sum">{(logIndex + 1) * sum * counts}</span>
        {:else}
          <span class="extra">{extra}</span>
          <span>]=</span>
          <span class="sum">{(logIndex + 1) * extra}</span>
        {/if}
      </li>
    {/each}
  {/if}
  {#if $phaseStore === PHASES.combo || $phaseStore === PHASES.score}
    {@const collapse = $logStore.length === 1}
    <li
      class:collapse
      in:slide={checkRapid({ duration: collapse ? 0 : 100 })}
      out:fade={checkRapid({ duration: 200 })}
    >
      {#if $phaseStore === PHASES.combo}
        <span out:fade={checkRapid({ duration: 200 })}>
          {collapse ? "" : "combo:"}
        </span>
      {/if}
      <span class="sum">
        {$phaseStore === PHASES.score && $scoreStore.buffer > 0
          ? "+"
          : ""}{$scoreStore.buffer}
      </span>
    </li>
  {/if}
  {#each $combosStore as { combo, key } (key)}
    <span class="combo">+{combo}</span>
  {/each}
</ol>

<style lang="postcss">
  .log {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    overflow: hidden;
    width: 100%;
    height: 100%;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 1rem 4rem 1rem 4.5rem;
    margin: 0;
    color: white;
    font-size: 5rem;
    letter-spacing: 0.5rem;
    line-height: 7rem;
    list-style-type: none;
    text-shadow: var(--gloss), var(--shadow-1);

    & li {
      display: flex;
      width: 100%;
      height: 7rem;
    }

    & span {
      margin: 0 -1rem;
    }

    & .combo {
      align-self: flex-end;
    }

    & .extra {
      color: var(--color-random);
    }

    & .sum {
      flex: 1;
      margin-right: 0;
      text-align: right;
    }

    & .collapse {
      margin-top: -7rem;
    }
  }

  :global {
    @keyframes colors-1 {
      0%,
      100% {
        color: white;
      }

      50% {
        color: var(--clr-1);
      }
    }

    @keyframes colors-2 {
      0%,
      100% {
        color: white;
      }

      33% {
        color: var(--clr-1);
      }

      66% {
        color: var(--clr-2);
      }
    }

    @keyframes colors-3 {
      0%,
      100% {
        color: white;
      }

      25% {
        color: var(--clr-1);
      }

      50% {
        color: var(--clr-2);
      }

      75% {
        color: var(--clr-3);
      }
    }

    @keyframes colors-4 {
      0%,
      100% {
        color: white;
      }

      20% {
        color: var(--clr-1);
      }

      40% {
        color: var(--clr-2);
      }

      60% {
        color: var(--clr-3);
      }

      80% {
        color: var(--clr-4);
      }
    }
  }
</style>

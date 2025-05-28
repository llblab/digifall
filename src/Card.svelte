<script>
  import { getNextCardValue } from "./core.js";

  let { card, index, blink, focus, longpress, plus } = $props();

  let nextValue = $derived(getNextCardValue(card.value));
</script>

<div
  class="card"
  class:blink
  class:focus
  class:longpress
  class:plus
  style:--card-x={card.x}
  style:--card-y={card.y}
  style:--card-duration={card.duration}
  data-index={index}
>
  <div class="value">
    <div
      class="current"
      class:cluster-top={card.cluster && card.cluster.top}
      class:cluster-right={card.cluster && card.cluster.right}
      class:cluster-bottom={card.cluster && card.cluster.bottom}
      class:cluster-left={card.cluster && card.cluster.left}
      class:only-shadow={card.y === 5}
      style:--color="var(--color-{card.value})"
    >
      {card.value}
    </div>
    <div
      class="next"
      class:only-shadow={card.y === 5}
      style:--color="var(--color-{nextValue})"
    >
      {nextValue}
    </div>
  </div>
</div>

<style>
  :global .card {
    position: absolute;
    z-index: var(--card-y);
    bottom: calc(var(--card-y) * 21rem);
    left: calc(var(--card-x) * 21rem);
    width: 21rem;
    height: 21rem;
    cursor: pointer;
    transition-duration: calc(var(--card-duration) * 1ms);
    transition-property: bottom;
    transition-timing-function: cubic-bezier(0.56, 0, 1, 1);
    will-change: bottom;

    &.blink {
      animation: fade-out 400ms ease 400ms forwards;
      box-shadow: none;

      .current {
        animation: blink 200ms steps(2, end) 2;
        box-shadow: none;
      }
    }

    &.focus {
      outline: none;
    }

    &.plus {
      z-index: 2;
      box-shadow: none;
      perspective: 128rem;

      .value {
        transform: rotateY(-180deg);
        transform-style: preserve-3d;
        transition: transform 400ms ease;
      }
    }

    &:not(.plus) {
      .current.cluster-top {
        --top-left: -10% -10%, -10% -10%;
        --top-right: 110% -10%, 110% -10%;
      }

      .current.cluster-right {
        --top-right: 110% -10%, 110% -10%;
        --bottom-right: 110% 110%, 110% 110%;
      }

      .current.cluster-bottom {
        --bottom-right: 110% 110%, 110% 110%;
        --bottom-left: -10% 110%, -10% 110%;
      }

      .current.cluster-left {
        --top-left: -10% -10%, -10% -10%;
        --bottom-left: -10% 110%, -10% 110%;
      }
    }

    .board.progress & {
      cursor: progress;
    }

    .board:not(.progress) & {
      &.focus {
        z-index: 20;
        box-shadow: none;
        filter: drop-shadow(0 0 1px white) drop-shadow(0 0 1px white)
          drop-shadow(0 0 1px white) drop-shadow(0 0 1px white);
        transform: translateX(-0.5px) translateY(-0.5px);

        .current {
          border-right: 0.5px solid var(--color);
          border-bottom: 1px solid var(--color);
          border-left: 0.5px solid var(--color);
          outline: none;
        }
      }

      &.longpress {
        z-index: var(--card-y);
        filter: none;
        transform: none;

        .current {
          border-right: none;
          border-bottom: none;
          color: var(--color);
          text-shadow: var(--shadow-0);

          &::after {
            position: absolute;
            top: 0;
            display: block;
            width: 100%;
            height: 100%;
            animation: longpress 400ms ease-out forwards;
            background-color: white;
            content: "";
            mix-blend-mode: overlay;
            opacity: 0.6;
          }
        }
      }
    }

    .current,
    .next {
      --top-left: -10% 17%, 17% -10%;
      --top-right: 83% -10%, 110% 17%;
      --bottom-right: 110% 83%, 83% 110%;
      --bottom-left: 17% 110%, -10% 83%;

      position: absolute;
      z-index: 10;
      display: flex;
      width: 21rem;
      height: 21rem;
      align-items: center;
      justify-content: center;
      backface-visibility: hidden;
      background-color: var(--color);
      clip-path: polygon(
        var(--top-left),
        var(--top-right),
        var(--bottom-right),
        var(--bottom-left)
      );
      color: white;
      filter: drop-shadow(var(--gloss)) drop-shadow(var(--shadow-0));
      font-size: 12rem;
      letter-spacing: 1rem;
      text-indent: 3rem;
      transition: clip-path 200ms ease;

      &.only-shadow {
        filter: drop-shadow(var(--shadow-0));
      }
    }

    .next {
      filter: var(--gloss) var(--shadow-1);
      transform: rotateY(-180deg);
    }

    @keyframes blink {
      from {
        background-color: white;
        color: var(--color);
      }

      to {
        background-color: var(--color);
        color: white;
      }
    }

    @keyframes fade-out {
      from {
        clip-path: circle(100%);
      }

      to {
        clip-path: circle(0%);
      }
    }

    @keyframes longpress {
      from {
        clip-path: circle(0%);
      }

      to {
        clip-path: circle(100%);
      }
    }
  }
</style>

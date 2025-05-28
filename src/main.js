import { mount } from "svelte";

import App from "./App.svelte";

import { initCore } from "./core.js";
import * as sounds from "./sounds.js";
import game from "./stores.js";

import "./leaderboard.js";

initCore(game, sounds);

const app = mount(App, {
  target: document.body,
});

export default app;

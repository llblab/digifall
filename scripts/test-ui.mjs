import assert from "node:assert/strict";

import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      "options",
      JSON.stringify({
        playerName: "tester",
        rapid: false,
        cluster: true,
        sound: false,
        leaderboard: false,
      }),
    );
    localStorage.setItem("timestamp", "1700000000000");
  });
  const reset = async () => {
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole("button", { name: "resume", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector(".overlay"));
  };
  const touch = (type, index = 14) =>
    page.locator(`.card[data-index="${index}"] .current`).dispatchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: type === "touchstart" ? [{ identifier: 1 }] : [],
    });
  const noOverlay = async () => {
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".card")].every(
        (card) =>
          !card.classList.contains("longpress") &&
          getComputedStyle(card.querySelector(".current"), "::after")
            .content === "none",
      ),
    );
  };
  const moves = () =>
    page.evaluate(async () => {
      const { movesStore } = await import("/src/stores.js");
      return movesStore.get();
    });
  await reset();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(50);
  assert.deepEqual(errors, [], "Tab must not throw when opening the menu");
  await page.locator(".menu").waitFor();
  await page.keyboard.press("ArrowUp");
  assert.equal(
    (await page.locator(".menu button.focus").textContent()).trim(),
    "options",
  );
  await page.keyboard.press("Enter");
  await page.locator(".options").waitFor();
  await page.keyboard.press("Tab");
  await page.locator(".menu").waitFor();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    (await page.locator(".menu button.focus").textContent()).trim(),
    "resume",
  );
  await page.keyboard.press("ArrowUp");
  assert.equal(
    (await page.locator(".menu button.focus").textContent()).trim(),
    "options",
  );
  await page.keyboard.press("ArrowDown");
  assert.equal(
    (await page.locator(".menu button.focus").textContent()).trim(),
    "resume",
  );
  await page.getByRole("button", { name: "new game", exact: true }).click();
  await page.locator(".dialog").waitFor();
  await page.keyboard.press("Tab");
  await page.locator(".dialog").waitFor({ state: "hidden" });
  await page.locator(".menu").waitFor();
  await page.keyboard.press("Tab");
  await page.locator(".overlay").waitFor({ state: "hidden" });
  assert.equal(
    await moves(),
    "",
    "Tab/dialog navigation must not reset or play the game",
  );
  console.log(
    "PASS: Tab opens/closes overlays and dismisses the new-game dialog first",
  );

  await reset();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowUp");
  await page.locator(".game .score.focus").waitFor();
  for (const [key, type] of [
    ["ArrowRight", "hi-score:"],
    ["Enter", "hi-combo:"],
    ["Space", "score:"],
    ["ArrowLeft", "hi-combo:"],
  ]) {
    await page.keyboard.press(key);
    assert.equal(
      (await page.locator(".game .score .type").textContent()).trim(),
      type,
    );
  }
  await page.locator(".game .score").click();
  assert.equal(
    (await page.locator(".game .score .type").textContent()).trim(),
    "score:",
  );
  assert.equal(await moves(), "");
  console.log("PASS: score types cycle with arrows, Enter, Space, and clicks");

  await reset();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
  await page.locator(".game .digifall.focus").waitFor();
  await page.keyboard.press("Enter");
  await page.locator(".menu").waitFor();
  await page.keyboard.press("Tab");
  await page.locator(".overlay").waitFor({ state: "hidden" });
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(50);
  assert.deepEqual(
    errors,
    [],
    "Restoring horizontal board focus must not throw",
  );
  assert.equal(await page.locator(".card.focus").count(), 1);
  assert.equal(await moves(), "");
  console.log(
    "PASS: board focus is restored horizontally after returning from the menu",
  );

  await reset();
  await touch("touchstart");
  await page.locator(".card.longpress").waitFor();
  await page.evaluate(async () => {
    const { optionsStore } = await import("/src/stores.js");
    optionsStore.update((o) => ({ ...o, rapid: true }));
  });
  await touch("touchend");
  await page.waitForTimeout(500);
  await noOverlay();
  assert.equal(
    await moves(),
    "",
    "Mode change must cancel the old hold, not apply a move",
  );
  await page.evaluate(async () => {
    const { resetGame } = await import("/src/stores.js");
    resetGame();
  });
  await page.waitForTimeout(700);
  await noOverlay();
  console.log(
    "PASS: rapid-mode change/release/reset cannot retain the circle overlay",
  );

  for (const cancel of [
    "touchend",
    "touchcancel",
    "blur",
    "reset",
    "overlay",
  ]) {
    await reset();
    await touch("touchstart");
    await page.locator(".card.longpress").waitFor();
    if (cancel === "reset") {
      await page.evaluate(async () =>
        (await import("/src/stores.js")).resetGame(),
      );
    } else if (cancel === "overlay") {
      await page.evaluate(async () =>
        (await import("/src/stores.js")).overlayStore.set("menu"),
      );
    } else if (cancel === "blur") {
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    } else {
      await touch(cancel);
    }
    await page.waitForTimeout(700);
    await noOverlay();
    assert.equal(
      await moves(),
      "",
      `${cancel} must prevent delayed move execution`,
    );
    console.log(`PASS: ${cancel} cancels the hold and timer`);
  }

  await reset();
  const cdp = await page.context().newCDPSession(page);
  const target = page.locator('.card[data-index="2"] .current');
  const before = await target.textContent();
  assert.equal(before.trim(), "0");
  const box = await target.boundingBox();
  await page.evaluate(() => {
    window.originalCard = document.querySelector('.card[data-index="2"]');
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await page.waitForTimeout(450);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(
    () => !document.querySelector(".board").classList.contains("progress"),
  );
  await noOverlay();
  assert.equal(await moves(), "Ag==");
  assert.notEqual((await target.textContent()).trim(), before.trim());
  assert.equal(
    await page.evaluate(
      () =>
        window.originalCard === document.querySelector('.card[data-index="2"]'),
    ),
    true,
  );
  console.log(
    "PASS: real touch completes a match and reuses the card without a stale overlay",
  );
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}

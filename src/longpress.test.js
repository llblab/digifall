import assert from "node:assert/strict";
import test from "node:test";

import { createLongpress } from "./longpress.js";

function setup(t) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), {
    defaultView: window,
    hidden: false,
  });
  const node = Object.assign(new EventTarget(), { ownerDocument: document });
  const events = [];
  for (const type of ["longpressstart", "longpressend", "longpressfire"]) {
    node.addEventListener(type, (event) => events.push(event));
  }
  const gesture = createLongpress(node);
  t.after(() => gesture.destroy());
  const send = (target, type, fields = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), fields);
    target.dispatchEvent(event);
    return event;
  };
  const start = () => send(node, "touchstart", { touches: [{}] });
  return { node, window, document, events, gesture, send, start };
}

test("one hold completes once at 400 ms with its original target", (t) => {
  const { start, events } = setup(t);
  const original = start();
  assert.equal(original.defaultPrevented, true);
  t.mock.timers.tick(399);
  assert.deepEqual(
    events.map((e) => e.type),
    ["longpressstart"],
  );
  t.mock.timers.tick(1);
  assert.equal(events[1].type, "longpressfire");
  assert.equal(events[1].detail, original);
  t.mock.timers.tick(1000);
  assert.equal(events.length, 2);
});

for (const type of ["touchend", "touchcancel", "mouseup", "blur", "pagehide"]) {
  test(`${type} cancels a hold`, (t) => {
    const { window, events, send, start } = setup(t);
    start();
    t.mock.timers.tick(100);
    send(window, type);
    t.mock.timers.tick(500);
    assert.deepEqual(
      events.map((e) => e.type),
      ["longpressstart", "longpressend"],
    );
  });
}

test("touch default prevention stays on the game surface, not the window", (t) => {
  const { node, window, send, start } = setup(t);
  assert.equal(send(window, "touchend").defaultPrevented, false);
  start();
  assert.equal(send(window, "touchend").defaultPrevented, false);
  start();
  assert.equal(send(node, "touchend").defaultPrevented, true);
});

test("hidden document cancels, visible document does not", (t) => {
  const { document, events, send, start } = setup(t);
  start();
  send(document, "visibilitychange");
  assert.equal(events.length, 1);
  document.hidden = true;
  send(document, "visibilitychange");
  t.mock.timers.tick(500);
  assert.deepEqual(
    events.map((e) => e.type),
    ["longpressstart", "longpressend"],
  );
});

test("a superseding press cancels the old timer, and release cancels the new one", (t) => {
  const { window, events, send, start } = setup(t);
  start();
  t.mock.timers.tick(100);
  start();
  t.mock.timers.tick(299);
  send(window, "touchend");
  t.mock.timers.tick(1000);
  assert.deepEqual(
    events.map((e) => e.type),
    ["longpressstart", "longpressend", "longpressstart", "longpressend"],
  );
});

test("multitouch cancels instead of starting another hold", (t) => {
  const { node, events, send, start } = setup(t);
  start();
  send(node, "touchstart", { touches: [{}, {}] });
  t.mock.timers.tick(500);
  assert.deepEqual(
    events.map((e) => e.type),
    ["longpressstart", "longpressend"],
  );
});

test("explicit context cancellation is idempotent and cannot fire later", (t) => {
  const { events, gesture, start } = setup(t);
  start();
  gesture.cancel();
  gesture.cancel();
  t.mock.timers.tick(500);
  assert.deepEqual(
    events.map((e) => e.type),
    ["longpressstart", "longpressend"],
  );
});

test("destroy cancels timers and removes event listeners", (t) => {
  const { events, gesture, start } = setup(t);
  start();
  gesture.destroy();
  start();
  t.mock.timers.tick(500);
  assert.deepEqual(
    events.map((e) => e.type),
    ["longpressstart", "longpressend"],
  );
});

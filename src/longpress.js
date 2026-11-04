/**
 * Owns one cancellable hold gesture, not game state or move execution.
 * The caller must cancel when its game/options context changes.
 */
export function createLongpress(node, { onStart, onFire, onEnd }) {
  const document = node.ownerDocument;
  const window = document.defaultView;
  let timer = null;
  const preventNativeTouchAction = (event) => {
    if (
      event.cancelable &&
      (event.type.startsWith("touch") || event.type === "contextmenu")
    ) {
      event.preventDefault();
    }
  };
  const cancel = (event) => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    onEnd(event);
  };
  const start = (event) => {
    preventNativeTouchAction(event);
    cancel(event);
    if (event.touches && event.touches.length !== 1) return;
    if (event.type === "mousedown" && event.button !== 0) return;
    timer = setTimeout(() => {
      timer = null;
      onFire(event);
    }, 400);
    onStart(event);
  };
  const stop = (event) => {
    preventNativeTouchAction(event);
    cancel(event);
  };
  const onVisibilityChange = (event) => {
    if (document.hidden) cancel(event);
  };
  const controller = new AbortController();
  const listeners = [
    [node, "mousedown", start],
    [node, "contextmenu", preventNativeTouchAction],
    [node, "touchstart", start, { passive: false }],
    [node, "touchmove", preventNativeTouchAction, { passive: false }],
    [node, "touchend", stop, { passive: false }],
    [node, "touchcancel", stop, { passive: false }],
    [window, "touchend", cancel],
    [window, "touchcancel", cancel],
    [window, "mouseup", stop],
    [window, "blur", cancel],
    [window, "pagehide", cancel],
    [document, "visibilitychange", onVisibilityChange],
  ];
  for (const [target, type, handler, options] of listeners) {
    target.addEventListener(type, handler, {
      ...options,
      signal: controller.signal,
    });
  }
  return {
    cancel,
    destroy() {
      cancel();
      controller.abort();
    },
  };
}

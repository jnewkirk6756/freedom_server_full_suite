/* Native-input regression checks for the neutral model viewer only.
 * Requires a Chromium page already on /model-viewer/ with its renderer ready.
 * No application values are assigned and no DOM input/change events are fired.
 * Touch uses Chromium's input protocol in a hasTouch browser context; it does
 * not certify Safari, Android hardware, or a physical touchscreen.
 */
const assert = require('node:assert/strict');

async function verifyNeutralScaleRange(page, { label = 'viewer', touch = false } = {}) {
  const range = page.locator('#model-scale');
  let cdp;
  const message = text => `${label}: ${text}`;

  async function read() {
    return range.evaluate(input => ({
      value: input.valueAsNumber,
      min: Number(input.min),
      max: Number(input.max),
      step: Number(input.step),
      disabled: input.disabled,
      output: document.getElementById('model-scale-output').textContent,
      scale: window.NocturneModelViewer.getState().transform.scale,
      canvasScale: Number(document.getElementById('model-canvas').dataset.scale),
    }));
  }

  async function assertBound(description, expected) {
    const state = await read();
    assert.equal(state.disabled, false, message(`${description}: range enabled`));
    assert.ok(Number.isFinite(state.value), message(`${description}: numeric value`));
    assert.ok(state.value >= state.min && state.value <= state.max, message(`${description}: value within bounds`));
    if (expected !== undefined) assert.equal(state.value, expected, message(`${description}: native range value`));
    assert.equal(state.output, `${state.value}%`, message(`${description}: visible percentage follows range`));
    assert.ok(Math.abs(state.scale - state.value / 100) < 1e-9, message(`${description}: transform follows range`));
    assert.ok(Math.abs(state.canvasScale - state.scale) < 1e-9, message(`${description}: canvas follows transform`));
    return state;
  }

  async function reset() {
    await page.locator('#reset-model').click();
    await range.scrollIntoViewIfNeeded();
    await assertBound('reset', 100);
  }

  async function clearEvents() {
    await range.evaluate(input => { input.__neutralRangeTest.events.length = 0; });
  }

  async function assertNativeEvents(description, committed) {
    const events = await range.evaluate(input => input.__neutralRangeTest.events);
    assert.ok(events.some(event => event.type === 'input'), message(`${description}: native input event`));
    if (committed) assert.ok(events.some(event => event.type === 'change'), message(`${description}: native change event on commit`));
    assert.ok(events.every(event => event.trusted), message(`${description}: browser-generated events only`));
  }

  async function coordinates(targetFraction) {
    await range.scrollIntoViewIfNeeded();
    const box = await range.boundingBox();
    assert.ok(box && box.width > 40 && box.height > 0, message('range has a usable pointer target'));
    const state = await read();
    // Native Chromium thumbs are approximately 16 CSS pixels wide. The reset
    // value is near the center, so small platform metric differences cannot
    // put this starting point outside the thumb.
    const inset = 8;
    const fraction = (state.value - state.min) / (state.max - state.min);
    const start = { x: box.x + inset + (box.width - inset * 2) * fraction, y: box.y + box.height / 2 };
    const end = { x: box.x + inset + (box.width - inset * 2) * targetFraction, y: start.y };
    for (const point of [start, end]) {
      const hitsRange = await range.evaluate((input, position) => document.elementFromPoint(position.x, position.y) === input, point);
      assert.equal(hitsRange, true, message('range receives pointer hit rather than an overlay'));
    }
    return { start, end, before: state.value };
  }

  async function assertMoved(description, before, fraction) {
    await page.waitForFunction(
      ({ previous, increasing }) => {
        const value = document.getElementById('model-scale').valueAsNumber;
        return increasing ? value > previous + 10 : value < previous - 10;
      },
      { previous: before, increasing: fraction > 0.5 },
      { timeout: 3000 },
    );
    return assertBound(description);
  }

  async function mouseDrag(fraction) {
    await reset();
    const { start, end, before } = await coordinates(fraction);
    await clearEvents();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    let during;
    try {
      await page.mouse.move(end.x, end.y, { steps: 8 });
      during = await assertMoved('mouse drag before release', before, fraction);
      await assertNativeEvents('mouse drag before release', false);
    } finally {
      await page.mouse.up();
    }
    await assertBound('mouse drag after release', during.value);
    await assertNativeEvents('mouse drag after release', true);
  }

  async function touchDrag(fraction) {
    await reset();
    const { start, end, before } = await coordinates(fraction);
    await clearEvents();
    const point = (x, y) => ({ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(start.x, start.y)] });
    let during;
    try {
      for (let step = 1; step <= 8; step++) {
        const x = start.x + (end.x - start.x) * step / 8;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(x, end.y)] });
      }
      during = await assertMoved('touch drag before release', before, fraction);
      await assertNativeEvents('touch drag before release', false);
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await assertBound('touch drag after release', during.value);
    await assertNativeEvents('touch drag after release', true);
  }

  await page.waitForFunction(() => document.getElementById('model-viewer').dataset.contextState === 'ready');
  assert.equal(await range.count(), 1, message('one native scale range'));
  await range.evaluate(input => {
    const events = [];
    const listener = event => events.push({ type: event.type, trusted: event.isTrusted });
    input.__neutralRangeTest = { events, listener };
    input.addEventListener('input', listener);
    input.addEventListener('change', listener);
  });

  try {
    await reset();
    const initial = await read();
    assert.equal(initial.step, 1, message('scale keyboard step'));
    await clearEvents();
    await range.focus();
    await page.keyboard.press('ArrowRight');
    await assertBound('keyboard increment', initial.value + initial.step);
    await page.keyboard.press('ArrowLeft');
    await assertBound('keyboard decrement', initial.value);
    await page.keyboard.press('Home');
    await assertBound('keyboard minimum', initial.min);
    await page.keyboard.press('ArrowLeft');
    await assertBound('keyboard clamps minimum', initial.min);
    await page.keyboard.press('End');
    await assertBound('keyboard maximum', initial.max);
    await page.keyboard.press('ArrowRight');
    await assertBound('keyboard clamps maximum', initial.max);
    assert.equal(await range.evaluate(input => document.activeElement === input), true, message('navigation leaves range keyboard focus intact'));
    await assertNativeEvents('keyboard', true);

    // Both directions are separate drags, catching stuck capture or release.
    await mouseDrag(0.8);
    await mouseDrag(0.2);
    if (touch) {
      assert.ok(await page.evaluate(() => navigator.maxTouchPoints > 0), message('touch-enabled test context required'));
      cdp = await page.context().newCDPSession(page);
      await touchDrag(0.8);
      await touchDrag(0.2);
    }
    await reset();
  } finally {
    await cdp?.detach();
    await range.evaluate(input => {
      const test = input.__neutralRangeTest;
      if (!test) return;
      input.removeEventListener('input', test.listener);
      input.removeEventListener('change', test.listener);
      delete input.__neutralRangeTest;
    });
  }
}

module.exports = { verifyNeutralScaleRange };

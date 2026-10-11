/* Deterministic VisualViewport and navigation regressions. These synthetic
 * keyboard measurements complement, not replace, real mobile hardware QA. */
const assert = require('node:assert/strict');

async function verifyMobileShellKeyboard(page, { label, touch }) {
  const summary = page.locator('#nocturne-screen-menu > summary');
  const filter = page.locator('#nocturne-screen-filter');
  const message = text => `${label}: ${text}`;
  await page.evaluate(() => {
    window.__shellViewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const viewport = new EventTarget();
    Object.assign(viewport, { height: innerHeight, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  });
  try {
    await page.evaluate(() => { document.getElementById('nocturne-screen-menu').open = true; });
    await filter.focus();
    const visibleHeight = await page.evaluate(() => {
      visualViewport.height = innerHeight - Math.min(300, Math.round(innerHeight * 0.52));
      window.dispatchEvent(new Event('resize'));
      return visualViewport.height;
    });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('nocturne-menu-keyboard-open')), touch, message('touch keyboard detection in either orientation'));
    if (touch) {
      const nav = await page.locator('#nocturne-navigation').boundingBox();
      const menu = await page.locator('.nocturne-menu-panel').boundingBox();
      assert.ok(nav.y >= 0 && nav.y + nav.height <= visibleHeight + 1, message('navigation stays above the keyboard'));
      assert.ok(menu.y >= 0 && menu.y + menu.height <= visibleHeight + 1, message('menu fits the visible viewport'));
      await filter.scrollIntoViewIfNeeded();
      const search = await filter.boundingBox();
      assert.ok(search.y >= menu.y && search.y + search.height <= menu.y + menu.height + 1, message('search remains reachable inside the scrollable menu'));
    }
    // A zoomed, focused field must not apply keyboard positioning a second time.
    await page.evaluate(() => { visualViewport.scale = 2; window.dispatchEvent(new Event('resize')); });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('nocturne-menu-keyboard-open')), false, message('pinch zoom is not treated as another keyboard'));
    await page.evaluate(() => { visualViewport.scale = 1; window.dispatchEvent(new Event('resize')); });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#nocturne-screen-menu').evaluate(menu => menu.open), false, message('Escape dismisses More'));
    assert.equal(await summary.evaluate(node => document.activeElement === node), true, message('Escape restores summary focus'));
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('nocturne-menu-keyboard-open')), false, message('leaving the field clears keyboard placement'));
    await summary.click();
    await page.locator('#nocturne-close-menu').click();
    assert.equal(await summary.evaluate(node => document.activeElement === node), true, message('repeated close restores summary focus'));
  } finally {
    await page.evaluate(() => {
      const descriptor = window.__shellViewportDescriptor;
      if (descriptor) Object.defineProperty(window, 'visualViewport', descriptor);
      else delete window.visualViewport;
      delete window.__shellViewportDescriptor;
      window.dispatchEvent(new Event('resize'));
    });
  }
}

module.exports = { verifyMobileShellKeyboard };

#!/usr/bin/env node
/* SCROLL STEADY. A finger scrolling the chat must move the page and nothing else: no bubble slides sideways, the composer
   never jumps. Born 24 Oct 2026 when Thulaib saw the chat flicker on his phone: a scroll starts with a pixel or two of
   sideways drift, the swipe to reply followed it, and the keyboard watcher read the browser bar as a keyboard.
   Real touch events through the browser's own input, a phone at 390 wide.   node scripts/scroll-steady.mjs */
import { chromium, serve, context, signIn } from './lib/world.mjs';
const { srv, base } = serve(); const b = await chromium.launch(); const c = await context(b, {}); const p = await c.newPage();
await signIn(p, base); await p.waitForSelector('bb-bubble');
const cdp = await c.newCDPSession(p); let bad = 0, n = 0;
const check = (name, ok, saw) => { n++; if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + name + '  [saw: ' + JSON.stringify(saw) + ']'); };
await p.evaluate(() => { window.__moves = { bub: 0, dock: new Set() }; const dock = document.querySelector('.dock');
  new MutationObserver(ms => ms.forEach(m => { const t = m.target; if (t.classList?.contains('bub') && /translateX\(\d/.test(t.style.transform)) window.__moves.bub++; })).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
  const read = () => window.__moves.dock.add(Math.round(dock.getBoundingClientRect().bottom)); read(); addEventListener('scroll', read, { passive: true }); setInterval(read, 16); });
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
/* six scrolls, each starting with the small sideways drift a real thumb has, on a bubble in the middle of the screen */
for (const drift of [2, 4, 6, 8, 3, 5]) {
  const x = 120, y = 520; await touch('touchStart', x, y);
  /* a real thumb: the first moves are a pixel or two, often more sideways than up, then the scroll takes over */
  const path = [[1, 0], [2, 1], [drift / 2, 1], [drift, 2], ...Array.from({ length: 10 }, (_, i) => [drift, 4 + i * 22])];
  for (const [dx, dy] of path) { await touch('touchMove', x + dx, y - dy); await p.waitForTimeout(16); }
  await touch('touchEnd', 0, 0); await p.waitForTimeout(250);
}
const m = await p.evaluate(() => ({ bub: window.__moves.bub, dock: [...window.__moves.dock] }));
check('a vertical scroll never slides a bubble sideways', m.bub === 0, m.bub + ' sideways moves');
check('a vertical scroll never moves the composer', m.dock.length === 1, m.dock);
/* and the swipe to reply still works when the finger really means it */
const el = await p.locator('[data-msg="wm7"] .bub').boundingBox(); await p.evaluate(() => document.querySelector('[data-msg="wm7"]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
const bx = await p.locator('[data-msg="wm7"] .bub').boundingBox(); await touch('touchStart', bx.x + 20, bx.y + 20);
for (let i = 1; i <= 8; i++) { await touch('touchMove', bx.x + 20 + i * 12, bx.y + 20 + (i % 2)); await p.waitForTimeout(16); }
await touch('touchEnd', 0, 0); await p.waitForTimeout(300);
check('a real sideways swipe still replies', /Dilan/.test(await p.locator('bb-composer .rp').textContent().catch(() => '') || ''), await p.locator('bb-composer .rp').count());
await b.close(); srv.close();
console.log(bad ? `FAIL ${n - bad} of ${n} scroll checks` : `PASS ${n} of ${n} scroll checks: the chat holds still under a scrolling thumb`); process.exit(bad ? 1 : 0);

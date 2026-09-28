#!/usr/bin/env node
/* ACCESSIBILITY, asserted in a real browser on every screen and every sheet, in day and in night:
   a focus a keyboard can see, the current tab marked, a pressed state on every toggle, every sheet
   a named dialogue with focus in and back, every control named, every field labelled and every
   word readable against what it sits on.
     node scripts/a11y.mjs        exits 1 on any failure */
import { chromium, serve, context, signIn } from './lib/world.mjs';
const results = []; const check = (name, pass, saw) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (saw !== undefined ? '  [saw: ' + (typeof saw === 'string' ? saw : JSON.stringify(saw)) + ']' : '')); };
const { srv, base } = serve(); const browser = await chromium.launch();
const SCREENS = ['#/start', '#/library/month', '#/library/videos', '#/library/posts', '#/library/docs', '#/library/business', '#/sales/dashboard', '#/sales/enquiries?view=board', '#/sales/enquiries?view=list', '#/sales/pipeline?view=board', '#/sales/pipeline?view=list', '#/sales/customers', '#/sales/tasks'];
const SHEETS = [['#/sales/enquiries?view=list', 'enquiry-new'], ['#/sales/enquiries?view=list', 'enquiry-open'], ['#/sales/pipeline?view=board', 'deal-new'], ['#/sales/pipeline?view=board', 'deal-open'], ['#/sales/customers', 'customer-new'], ['#/sales/customers', 'customer-open'], ['#/sales/tasks', 'task-new'], ['#/sales/tasks', 'task-open']];
/* runs in the page: names, labels and contrast of everything that can be seen */
const SCAN = () => {
  /* with a sheet open, the sheet is what a person can reach: the page behind is under the scrim */
  const top = [...document.querySelectorAll('.drawer.on')].pop() || document.body;
  const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); if (!(r.width > 1 && r.height > 1) || c.visibility === 'hidden' || c.display === 'none') return false; for (let n = e; n; n = n.parentElement) { const k = getComputedStyle(n); if (parseFloat(k.opacity) < .1 || k.visibility === 'hidden' || n.hasAttribute('inert')) return false; } return true; };
  const name = e => (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
  const out = { unnamed: [], unlabelled: [], noAlt: [], dim: [], toggles: [], small: [] };
  const where = e => (e.getAttribute('data-act') || e.id || e.className || e.tagName).toString().slice(0, 40);
  top.querySelectorAll('button,a[href],[role="button"]').forEach(e => { if (vis(e) && !name(e)) out.unnamed.push(where(e)); });
  top.querySelectorAll('input,select,textarea').forEach(e => { if (!vis(e) || e.type === 'hidden') return; const ok = e.getAttribute('aria-label') || (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label'); if (!ok) out.unlabelled.push(where(e)); });
  top.querySelectorAll('img').forEach(e => { if (vis(e) && !e.hasAttribute('alt')) out.noAlt.push(e.src.split('/').pop()); });
  /* a toggle says whether it is on */
  top.querySelectorAll('.seg button,.chips button,.ladder button,.tick,[data-act$="theme"]').forEach(e => { if (vis(e) && !e.hasAttribute('aria-pressed')) out.toggles.push(where(e)); });
  /* a finger needs 40px of target on a touch screen, in both directions, for anything that stands alone */
  if (matchMedia('(pointer:coarse)').matches) top.querySelectorAll('button,a[href],select,input:not([type=hidden])').forEach(e => { if (!vis(e)) return; const r = e.getBoundingClientRect(); if (e.closest('p,li,.foot,.demo')) return; if (r.height < 40 && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline')) out.small.push(where(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  /* contrast: the colour of the words against the first solid colour behind them */
  const rgb = c => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const over = (top, under) => { const a = top[3] === undefined ? 1 : top[3]; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)); };
  const behind = e => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if ((c[3] === undefined ? 1 : c[3]) > 0) { stack.push(c); if ((c[3] === undefined ? 1 : c[3]) >= .99) break; } } let base = rgb(getComputedStyle(document.documentElement).backgroundColor).slice(0, 3); if (!stack.length) return base; let col = (stack[stack.length - 1][3] ?? 1) >= .99 ? stack.pop().slice(0, 3) : base; while (stack.length) col = over(stack.pop(), col); return col; };
  const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT); const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) { const e = t.parentElement; if (!e || !t.textContent.trim() || seen.has(e) || !vis(e) || e.closest('[disabled],script,style,.sr,.sr-only')) continue; seen.add(e);
    const cs = getComputedStyle(e), fg = over(rgb(cs.color), behind(e)), bg = behind(e); const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const px = parseFloat(cs.fontSize), big = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700), need = big ? 3 : 4.5;
    if (ratio < need - .01) out.dim.push(t.textContent.trim().slice(0, 24) + ' ' + ratio.toFixed(2) + ' (' + where(e) + ')'); }
  return out;
};
const sum = {}; const add = (k, where, list) => list.forEach(x => (sum[k] ||= new Set()).add(where + ': ' + x));
for (const [tag, opt] of [['phone day', {}], ['phone night', { dark: true }], ['desk day', { desk: true, width: 1440 }], ['desk night', { desk: true, width: 1440, dark: true }]]) {
  const desk = !!opt.desk; const c = await context(browser, opt); const p = await c.newPage(); const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(450); };
  const press = s => desk ? p.locator(s + ':visible').first().click() : p.locator(s + ':visible').first().tap();
  await p.goto(base); await p.waitForSelector('#biz'); const door = await p.evaluate(SCAN); Object.entries(door).forEach(([k, v]) => add(k, tag + ' door', v));
  await signIn(p, base);
  for (const h of SCREENS) { await go(h); const r = await p.evaluate(SCAN); Object.entries(r).forEach(([k, v]) => add(k, tag + ' ' + h, v));
    if (/sales|library/.test(h)) { const cur = await p.evaluate(() => ({ rail: [...document.querySelectorAll('.rail a[aria-current="page"]')].length, tab: [...document.querySelectorAll('.bm-btn[aria-current="page"]')].length })); if (cur.rail !== 1 || (!desk && cur.tab !== 1)) add('current', tag + ' ' + h, ['rail ' + cur.rail + ', tab ' + cur.tab]); } }
  for (const [h, act] of SHEETS) { await go(h); const opener = p.locator('[data-act="' + act + '"]:visible').first(); await opener.focus().catch(() => {}); await press('[data-act="' + act + '"]'); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(450);
    const d = await p.evaluate(() => { const s = [...document.querySelectorAll('.drawer.on')].pop(); const t = document.getElementById(s.getAttribute('aria-labelledby')); return { role: s.getAttribute('role'), modal: s.getAttribute('aria-modal'), title: (t?.textContent || '').trim(), focusIn: s.contains(document.activeElement), behindInert: [...document.querySelectorAll('.drawer:not(.on)')].every(x => x.hasAttribute('inert')) }; });
    if (d.role !== 'dialog' || d.modal !== 'true' || !d.title || !d.focusIn) add('dialog', tag + ' ' + act, [JSON.stringify(d)]);
    const r = await p.evaluate(SCAN); Object.entries(r).forEach(([k, v]) => add(k, tag + ' sheet ' + act, v));
    if (desk) { for (let i = 0; i < 40; i++) await p.keyboard.press('Tab'); const held = await p.evaluate(() => [...document.querySelectorAll('.drawer.on')].pop().contains(document.activeElement)); if (!held) add('trap', tag + ' ' + act, ['Tab left the sheet']); }
    await p.keyboard.press('Escape'); await p.waitForTimeout(450);
    const backOn = await p.evaluate(a => document.activeElement?.getAttribute('data-act') === a, act); if (!backOn) add('focusBack', tag + ' ' + act, [await p.evaluate(() => (document.activeElement?.getAttribute('data-act') || document.activeElement?.tagName))]); }
  /* a focus a keyboard can SEE: Tab through a screen and look at what each stop draws */
  if (desk) { for (const h of ['#/start', '#/sales/dashboard', '#/sales/pipeline?view=list', '#/sales/tasks']) { await go(h); await p.evaluate(() => document.activeElement?.blur()); const bad = [];
      for (let i = 0; i < 30; i++) { await p.keyboard.press('Tab'); const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const c = getComputedStyle(e); const ring = c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2; const edge = parseFloat(c.borderTopWidth) > 0 && c.borderTopColor !== getComputedStyle(e.parentElement).borderTopColor; return { ring: ring || (/(INPUT|SELECT|TEXTAREA)/.test(e.tagName) && edge), what: (e.getAttribute('data-act') || e.getAttribute('aria-label') || e.tagName).slice(0, 30) }; }); if (f && !f.ring) bad.push(f.what); }
      add('focus', tag + ' ' + h, [...new Set(bad)]); } }
  await c.close();
}
await browser.close(); srv.close();
const say = (k, name) => { const list = [...(sum[k] || [])]; check(name, list.length === 0, list.length ? list.length + ' found, first: ' + list.slice(0, 4).join(' | ') : 'none on any screen or sheet'); if (list.length) [...new Set(list.map(x => x.replace(/^(phone|desk) (day|night) /, '')))].slice(0, 40).forEach(x => console.log('     ' + x)); };
say('unnamed', 'every button and link has a name a screen reader can say');
say('unlabelled', 'every field has a label');
say('noAlt', 'every picture says what it is, or says it is decoration');
say('toggles', 'every toggle says whether it is pressed');
say('current', 'the current screen is marked, once, in the rail and in the tab bar');
say('dialog', 'every sheet is a named dialogue and takes the focus when it opens');
say('trap', 'Tab stays inside an open sheet');
say('focusBack', 'closing a sheet gives the focus back to what opened it');
say('focus', 'a focus a keyboard can see, at every stop');
say('small', 'on a touch screen every target that stands alone is 40px or taller');
say('dim', 'every word is readable against what it sits on (4.5 to 1, or 3 to 1 for large type)');
const bad = results.filter(r => !r.pass); console.log('\n' + (results.length - bad.length) + ' of ' + results.length + ' passed.'); process.exit(bad.length ? 1 : 0);

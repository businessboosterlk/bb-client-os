/* What every Hub runner shares: a server for the built app, a seeded demo book and the door walk.
   The door is WALKED, never skipped: the runner types the demo business and the demo code that the
   door itself prints, so a broken sign in breaks every run (test-the-door-people-walk-through). */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { chromium, webkit } = require(process.env.HOME + '/bb-systems/batch/node_modules/playwright');
export const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const DIST = path.join(ROOT, 'apps/web/dist/web/browser');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
/* over: files answered from memory instead of from the build, for example a config.json that names
   a mock API. The address can name an API too, but a page with a base address drops the question
   mark part of its own address on the first navigation, so a reload would forget it. */
export function serve(dir = DIST, over = {}) {
  const srv = http.createServer((q, r) => {
    /* the build is also answered under the folder it is published in, the address people really use */
    q.url = q.url.replace(/^\/bb-client-os(?=\/|$)/, '') || '/';
    const name = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
    if (over[name] !== undefined) { r.writeHead(200, { 'Content-Type': TYPES[path.extname(name)] || 'text/plain', 'Cache-Control': 'no-store' }); return r.end(typeof over[name] === 'function' ? over[name]() : over[name]); }
    let f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(fs.readFileSync(f));
  }).listen(0);
  return { srv, base: 'http://127.0.0.1:' + srv.address().port + '/' };
}
const ago = d => new Date(Date.now() - d * 864e5).toISOString();
export const SEED = {
  enquiries: [
    { id: 'e1', name: 'Harness Co', phone: '0771234567', wants: 'Two boxes of quills a month', source: 'Instagram', status: 'new', createdAt: ago(1), updatedAt: ago(1) },
    { id: 'e2', name: 'Galle Fort Bakery', phone: '0712223344', wants: 'Ground cinnamon, 5kg', source: 'WhatsApp', status: 'new', createdAt: ago(2), updatedAt: ago(2) },
    { id: 'e3', name: 'Nimal Perera', phone: '0765556677', wants: 'Gift packs for Avurudu', source: 'Referral', status: 'contacted', createdAt: ago(4), updatedAt: ago(3) },
    { id: 'e4', name: 'Old Request', wants: 'Asked once', source: 'Website', status: 'closed', createdAt: ago(30), updatedAt: ago(28) }],
  deals: [
    { id: 'd1', name: 'Quiet Ltd', phone: '0771112223', wants: 'Hotel welcome hampers, 40 a month', stage: 'talking', value: 120000, nextStep: 'Send the price list', nextAt: ago(-2).slice(0, 10), stageAt: ago(9), lastContactAt: ago(9), createdAt: ago(12), updatedAt: ago(9) },
    { id: 'd2', name: 'Busy Ltd', phone: '0719998887', wants: 'Bulk quills', stage: 'quoted', value: 45000, stageAt: ago(1), lastContactAt: ago(1), createdAt: ago(3), updatedAt: ago(1) },
    { id: 'd3', name: 'Closing Traders', wants: 'Export sample order', stage: 'closing', value: 310000, nextStep: 'Confirm the date', stageAt: ago(2), lastContactAt: ago(2), createdAt: ago(20), updatedAt: ago(2) },
    { id: 'd4', name: 'Won Hotel', phone: '0774445556', wants: 'Monthly supply', stage: 'won', value: 250000, customerId: 'c1', stageAt: ago(3), lastContactAt: ago(3), createdAt: ago(25), updatedAt: ago(3) },
    { id: 'd5', name: 'Lost Cafe', wants: 'Small order', stage: 'lost', value: 8000, lostReason: 'Price too high', stageAt: ago(6), lastContactAt: ago(6), createdAt: ago(15), updatedAt: ago(6) }],
  customers: [
    { id: 'c1', name: 'Won Hotel', phone: '0774445556', bought: 'Monthly supply', value: 250000, since: ago(3).slice(0, 10), dealId: 'd4', notes: 'Prefers delivery on Fridays', createdAt: ago(3), updatedAt: ago(3) },
    { id: 'c2', name: 'Long Standing Stores', phone: '0112345678', bought: 'Quills and powder', value: 980000, since: ago(200).slice(0, 10), createdAt: ago(200), updatedAt: ago(45) }],
  activities: [
    { id: 'a1', dealId: 'd1', type: 'call', summary: 'Called them', createdAt: ago(9), updatedAt: ago(9) },
    { id: 'a2', dealId: 'd1', type: 'note', summary: 'Started from an enquiry via Instagram', createdAt: ago(12), updatedAt: ago(12) }],
  tasks: [
    { id: 't1', text: 'Call back Quiet Ltd', due: ago(1).slice(0, 10), done: false, dealId: 'd1', who: 'Amara', createdAt: ago(2), updatedAt: ago(2) },
    { id: 't2', text: 'Send the October price list', due: ago(0).slice(0, 10), done: false, createdAt: ago(1), updatedAt: ago(1) },
    { id: 't3', text: 'Thank Won Hotel', due: ago(2).slice(0, 10), done: true, createdAt: ago(4), updatedAt: ago(1) }]
};
export const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
export async function context(browser, { width = 390, height = 844, desk = false, dark = false, seed = SEED, fonts = false } = {}) {
  const c = await browser.newContext(desk
    ? { viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' }
    : { viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, userAgent: PHONE_UA, colorScheme: dark ? 'dark' : 'light' });
  await c.addInitScript(([s, d]) => { try { if (s && !localStorage.getItem('bbos_demo')) localStorage.setItem('bbos_demo', s); if (!localStorage.getItem('hub_theme')) localStorage.setItem('hub_theme', d ? 'dark' : 'light'); } catch (e) {} }, [seed ? JSON.stringify(seed) : '', dark]);
  /* layout runs stand the system font in so they never wait on another server. A run that measures
     INK asks for the real font: measuring a stand-in is measuring the wrong surface. */
  if (!fonts) await c.route('**/fonts.g*/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  return c;
}
/* the door, walked: business, code, Enter */
export async function signIn(p, base) {
  await p.goto(base); await p.waitForSelector('#biz', { timeout: 15000 });
  await p.fill('#biz', 'cinnamon.lk'); await p.fill('#pin', '1111');
  await p.locator('.enter').click();
  await p.waitForFunction(() => /#\/start/.test(location.hash), null, { timeout: 15000 });
}

/* THE GAP AUDIT, ported from the Inspo Hub harness (phone-run.mjs, section 21c, 27 Sep 2026).
   Runs INSIDE the page. No list of class names decides what is measured: a control is anything a
   finger meets that has an edge. It fails on two controls touching, overlapping or crowding, on
   anything sitting on an edge, on a sideways row that starts on the glass, on a message that is
   shown and covered and on a picture that failed to load. */
export const AUDIT = () => {
  const sheet = [...document.querySelectorAll('.drawer.on')].pop();
  const rail = document.querySelector('.rail.open');
  const root = sheet || rail || document.querySelector('.door') || document.querySelector('.main') || document.querySelector('.wrap') || document.body;
  const clear = c => !c || /rgba\(0, 0, 0, 0\)|transparent/.test(c);
  const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); if (!(r.width > 3 && r.height > 3) || c.visibility === 'hidden' || c.display === 'none' || parseFloat(c.opacity) <= 0.05) return false; for (let n = e.parentElement; n; n = n.parentElement) { const k = getComputedStyle(n); if (k.visibility === 'hidden' || parseFloat(k.opacity) <= 0.05) return false; } return true; };
  const edged = e => { const c = getComputedStyle(e); return (parseFloat(c.borderTopWidth) > 0 && !clear(c.borderTopColor)) || (parseFloat(c.borderBottomWidth) > 0 && !clear(c.borderBottomColor)) || !clear(c.backgroundColor); };
  const ctl = [...root.querySelectorAll('button,a,input,select,textarea,.seg,.card,.dc,.pill')].filter(e => vis(e) && (edged(e) || /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) && e.type !== 'file' && !e.closest('.bm-sub:not(.on)'));
  const pinned = e => { for (let n = e; n && n !== root; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'sticky' || p === 'fixed') return n; } return null; };
  /* rows of one list are JOINED, not crowded: they share a parent and a box with its own border clips
     them, the list itself or the card the list sits in. Measured, never named. */
  const clips = n => { if (!n) return false; const c = getComputedStyle(n); return c.overflow !== 'visible' && parseFloat(c.borderTopWidth) > 0; };
  const joined = (a, b) => { const p = a.parentElement; if (p !== b.parentElement) return false; return clips(p) || clips(p.parentElement); };
  /* what scrolls up and down inside a sheet passes UNDER the sheet's action bar, which is how a
     pinned bar works. Two controls are compared only when they ride in the same scroller. */
  const vscroller = e => { for (let n = e.parentElement; n && n !== root; n = n.parentElement) { const c = getComputedStyle(n); if (/(auto|scroll)/.test(c.overflowY) && n.scrollHeight > n.clientHeight + 2) return n; } return null; };
  const scroller = e => { for (let n = e.parentElement; n && n !== root; n = n.parentElement) { const c = getComputedStyle(n); if (/(auto|scroll)/.test(c.overflowX) && n.scrollWidth > n.clientWidth + 2) return n; } return null; };
  const name = e => (e.id ? '#' + e.id : (String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className).split(' ').filter(Boolean).slice(0, 2).join('.') || e.tagName.toLowerCase())) + (e.textContent.trim() ? ' "' + e.textContent.trim().replace(/\s+/g, ' ').slice(0, 18) + '"' : '');
  const hits = [];
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
    const a = ctl[i], b = ctl[j]; if (a.contains(b) || b.contains(a) || joined(a, b)) continue;
    if (pinned(a) !== pinned(b) || vscroller(a) !== vscroller(b)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const sa = scroller(a), sb = scroller(b); if (sa !== sb && (sa || sb)) { const s = (sa || sb).getBoundingClientRect(); if (ra.right < s.left || ra.left > s.right || rb.right < s.left || rb.left > s.right) continue; }
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ox > 4 && oy > 4) { hits.push('OVERLAP ' + name(a) + ' and ' + name(b) + ' by ' + Math.round(ox) + 'x' + Math.round(oy)); continue; }
    if (ox > 8) { const g = Math.max(rb.top - ra.bottom, ra.top - rb.bottom); if (g > -1 && g < 8) hits.push('STACKED ' + Math.round(g) + 'px: ' + name(a) + ' / ' + name(b)); }
    else if (oy > 8) { const g = Math.max(rb.left - ra.right, ra.left - rb.right); if (g > -1 && g < 6) hits.push('SIDE BY SIDE ' + Math.round(g) + 'px: ' + name(a) + ' | ' + name(b)); }
  }
  root.querySelectorAll('.err,.msg,[role="alert"]').forEach(e => { if (!vis(e) || !e.textContent.trim()) return; const r = e.getBoundingClientRect(), x = r.left + Math.min(r.width / 2, 40), y = r.top + Math.min(r.height / 2, 10); const top = document.elementFromPoint(x, y); if (r.bottom > innerHeight || r.top < 0 || !(top && (e === top || e.contains(top)))) hits.push('MESSAGE HIDDEN: "' + e.textContent.trim().slice(0, 40) + '" is covered by ' + (top ? name(top) : 'the edge of the screen')); });
  [...root.querySelectorAll('*')].filter(e => vis(e) && /(auto|scroll)/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 2 && e.scrollLeft < 2).forEach(sc => { const k = [...sc.children].find(vis); if (!k) return; const L = k.getBoundingClientRect().left - root.getBoundingClientRect().left; if (L < 8) hits.push('SCROLLER STARTS ON THE GLASS ' + Math.round(L) + 'px: ' + name(sc) + ' > ' + name(k)); });
  const rr = root.getBoundingClientRect();
  ctl.forEach(e => { if (scroller(e)) return; const r = e.getBoundingClientRect(); if (r.width < 4) return;
    if (r.left - rr.left < 8 && rr.width - r.width > 20) hits.push('ON THE LEFT EDGE ' + Math.round(r.left - rr.left) + 'px: ' + name(e));
    if (rr.right - r.right < 8 && r.left < rr.right && rr.width - r.width > 20) hits.push('ON THE RIGHT EDGE ' + Math.round(rr.right - r.right) + 'px: ' + name(e)); });
  /* words cut by their own box: a label or a placeholder that does not fit is a fault a person reads */
  [...root.querySelectorAll('button,a.btn,.pill,label,h1,h3,.k-label')].filter(vis).forEach(e => { if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible' && e.children.length === 0) hits.push('LABEL CUT: ' + name(e)); });
  [...root.querySelectorAll('input[placeholder]')].filter(vis).forEach(e => { if (e.value) return; const c = getComputedStyle(e); const cv = document.createElement('canvas').getContext('2d'); cv.font = c.fontWeight + ' ' + c.fontSize + ' ' + c.fontFamily; const ls = parseFloat(c.letterSpacing) || 0; const w = cv.measureText(c.textTransform === 'uppercase' ? e.placeholder.toUpperCase() : e.placeholder).width + ls * e.placeholder.length; const room = e.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight); if (w > room + 1) hits.push('PLACEHOLDER CUT by ' + Math.round(w - room) + 'px: "' + e.placeholder.slice(0, 30) + '"'); });
  /* THE SHEET ACTION BAR: one main button, and every row of the bar the same width, so nothing is ragged */
  root.querySelectorAll('.d-foot .bar').forEach(bar => { if (!vis(bar)) return;
    const kids = [...bar.children].filter(vis); const main = [...bar.querySelectorAll('.btn')].filter(b => vis(b) && !/\b(ghost|quiet|wa-ghost)\b/.test(b.className));
    if (main.length > 1) hits.push('TWO MAIN BUTTONS in one bar: ' + main.map(name).join(' and '));
    const w = kids.map(k => Math.round(k.getBoundingClientRect().width)); if (new Set(w).size > 1) hits.push('RAGGED BAR: rows of ' + [...new Set(w)].join(', ') + 'px');
    bar.querySelectorAll('.pair').forEach(pr => { const pw = [...pr.children].filter(vis).map(k => Math.round(k.getBoundingClientRect().width)); if (Math.max(...pw) - Math.min(...pw) > 1) hits.push('UNEQUAL PAIR: ' + pw.join(', ') + 'px'); });
    [...bar.querySelectorAll('.btn')].filter(vis).forEach(b => { if (b.getBoundingClientRect().height < 44) hits.push('BAR BUTTON UNDER 44px: ' + name(b)); }); });
  const torn = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && getComputedStyle(i).display !== 'none' && i.getBoundingClientRect().width > 0).length;
  if (torn) hits.push('TORN PICTURE: ' + torn + ' failed to load');
  if (document.documentElement.scrollWidth > innerWidth + 1) hits.push('PAGE SCROLLS SIDEWAYS by ' + (document.documentElement.scrollWidth - innerWidth) + 'px');
  return [...new Set(hits)];
};

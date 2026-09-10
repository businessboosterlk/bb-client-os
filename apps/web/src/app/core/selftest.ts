import { CastService } from './cast.service';
import { DataService, waLink } from './data.service';

/* ?selftest runs the harness on THIS cast in THIS browser and prints one line per
   check. It uses a throwaway store key so a client's real rows are never touched,
   and it restores the real store when it is done. A check that cannot find its
   target FAILS; nothing here passes by being unable to look. */
export async function runSelftest(cast: CastService, data: DataService){
  const T: [boolean, string, string][] = [];
  const ok = (name: string, pass: boolean, note = '') => T.push([!!pass, name, note]);
  const c = cast.cast();
  const cs = getComputedStyle(document.documentElement);
  if (c) {
  ok('cast loaded with slug, name, wa and a brand hex', !!c.slug && !!c.name && /^94\d{9}$/.test(c.wa) && /^#[0-9a-f]{6}$/i.test(c.brand.hex));
  ok('palette derived from the one brand hex', cs.getPropertyValue('--brand').trim().toLowerCase() === c.brand.hex.toLowerCase() && cs.getPropertyValue('--brand-soft').trim() !== '');
  ok('manifest named for this client', ((document.getElementById('manifest') as HTMLLinkElement)?.href || '').includes(encodeURIComponent(c.name.split(' ')[0])));
  }
  ok('viewport covers the notch', /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]')?.getAttribute('content') || ''));
  ok('safe area variables in use', cs.getPropertyValue('--sat') !== '' && !!document.querySelector('.statusfill'));
  /* one colour at the top: inside the shell the glass topbar paints the inset and the
     strip is gone; on the door the strip and the page share the same dark ink */
  const strip = document.querySelector('.statusfill') as HTMLElement;
  const inShell = document.body.classList.contains('in-shell');
  ok('status strip is one colour with the screen under it',
     inShell ? getComputedStyle(strip).display === 'none'
             : (cs.getPropertyValue('--top').trim() === (document.querySelector('.login-card') ? cs.getPropertyValue('--sidebar').trim() : '#f5f5f7')),
     inShell ? 'shell: topbar owns the inset' : 'door or launcher: --top ' + cs.getPropertyValue('--top').trim());
  ok('browser chrome colour matches the screen too',
     (document.querySelector('meta[name=theme-color]')?.getAttribute('content') || '') === (inShell ? '#f5f5f7' : cs.getPropertyValue('--top').trim()));
  ok('no field under 16px on a coarse pointer', (() => { const s = document.createElement('style'); s.textContent = ''; const q = matchMedia('(pointer:coarse)').matches; if (!q) return true; return [...document.querySelectorAll('input,select,textarea')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16); })());
  ok('no emoji glyph in page text', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.body.innerText));
  ok('no em or en dash in copy', !/[—–]/.test(document.body.innerText));
  ok('no comma before and, or, but or nor', !/,\s+(and|or|but|nor)\b/i.test(document.body.innerText));
  const clipped = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && getComputedStyle(e).visibility !== 'hidden' && !inScroller(e));
  /* a zero-wide viewport is a hidden pane, not a layout: say so instead of blaming the page */
  ok('nothing clipped off the right edge', clipped.length === 0, innerWidth === 0 ? 'viewport is 0px wide: pane hidden, nothing measured' : clipped.length + ' offenders at ' + innerWidth + 'px');
  const desk = innerWidth >= 1020;
  const rail = document.querySelector('.rail') as HTMLElement | null;
  const tabs = document.querySelector('.bm-bar') as HTMLElement | null;
  if (rail && tabs) {
    ok('nav matches width: rail on desk, tab bar on phone', desk ? getComputedStyle(rail).visibility !== 'hidden' && tabs.getBoundingClientRect().height === 0 : tabs.getBoundingClientRect().height > 0, innerWidth + 'px');
    ok('rail carries two groups, Library and Sales, with a divider', document.querySelectorAll('.rail .grp').length === 2 && !!document.querySelector('.rail hr.div'));
    ok('the other system starts collapsed', document.querySelectorAll('.rail .grp.off').length === 1);
    ok('every icon is a stroke svg, none an image or emoji', [...document.querySelectorAll('bb-icon svg')].length > 0 && [...document.querySelectorAll('.rail nav a')].every(a => a.querySelector('svg')));
    ok('the phone bar is a small floating pill, not a full-width strip', desk || (tabs.getBoundingClientRect().width < innerWidth * 0.75 && parseFloat(getComputedStyle(tabs).borderRadius) >= 16), desk ? 'desk' : Math.round(tabs.getBoundingClientRect().width) + 'px of ' + innerWidth);
    ok('the panel grows on the reference curve, 300ms, from the bottom centre, without clipping its shadow', (() => { if (desk) return true; const sub = document.querySelector('.bm-sub') as HTMLElement | null; const card = document.querySelector('.bm-card') as HTMLElement | null; if (!sub || !card) return false; const cs = getComputedStyle(sub), cc = getComputedStyle(card); const o = cs.transformOrigin.split(' ').map(parseFloat); const r = sub.getBoundingClientRect();
      const curve = 'cubic-bezier(0.45, 0, 0.25, 1)';
      const subOk = cs.transitionDuration.split(', ').every(d => d === '0.3s') && cs.transitionTimingFunction === [curve, curve, curve].join(', ');
      const cardOk = /clip-path/.test(cc.transitionProperty) && cc.transitionDuration === '0.3s' && cc.transitionTimingFunction === curve && /inset/.test(cc.clipPath);
      const noLayoutAnim = !/width|height/.test(cs.transitionProperty);
      const shadowFree = cs.overflow !== 'hidden' && cs.boxShadow !== 'none';
      return subOk && cardOk && noLayoutAnim && shadowFree && Math.abs(o[0] - r.width / 2) < 1 && Math.abs(o[1] - r.height) < 1; })(),
      desk ? 'desk' : (document.querySelector('.bm-sub') ? 'sub: ' + getComputedStyle(document.querySelector('.bm-sub')!).transitionProperty + ' · card: ' + getComputedStyle(document.querySelector('.bm-card')!).transitionProperty : 'no panel'));
    ok('tap targets in the rail and tab bar are 40px or taller', [...document.querySelectorAll('.rail nav a, .bm-btn')].filter(a => a.getBoundingClientRect().height > 0).every(a => a.getBoundingClientRect().height >= 40));
  } else {
    /* no shell on this screen: it must be the door or the launcher, and each has its own anatomy */
    const door = document.querySelector('.login-card'), doors = document.querySelectorAll('.door');
    ok('a screen without the shell is the door or the launcher', !!door || doors.length === 2, door ? 'login' : doors.length + ' doors');
    ok('the door asks for a business name and a code, nothing else', !door || (!!document.getElementById('biz') && !!document.getElementById('pin') && document.querySelectorAll('.login-card input').length === 2));
    ok('the PIN field cannot zoom the page on a phone', !door || parseFloat(getComputedStyle(document.getElementById('pin')!).fontSize) >= (matchMedia('(pointer:coarse)').matches ? 16 : 14));
    ok('the launcher offers exactly two doors, Library and Sales', !!door || (doors.length === 2 && /library/i.test(doors[0].textContent || '') && /sales/i.test(doors[1].textContent || '')));
    ok('sign in and the doors are 44px or taller', [...document.querySelectorAll('.login-card .btn, .door')].every(a => a.getBoundingClientRect().height >= 44));
    ok('the static alias book lists only PIN-protected local casts', await fetch('casts/index.json', { cache: 'no-cache' }).then(r => r.json()).then((idx: any[]) => idx.every(i => i.slug === 'demo')).catch(() => false));
    ok('the door never carries a seat code in the page', !door || !/[A-Z]{3}-[A-Z0-9]{4}-[A-Z0-9]{4}/.test(document.body.innerText));
  }
  ok('a local number becomes a real WhatsApp link', waLink('0771234567', 'X') === 'https://wa.me/94771234567?text=Hello%20X%2C%20' && waLink('', 'X') === '');
  /* behaviour, on a throwaway store */
  if (c && data.mode() === 'local') {
  const real = localStorage.getItem('bbos_' + c.slug);
  try {
    localStorage.setItem('bbos_' + c.slug, '{}'); await data.reload();
    const e = await data.addEnquiry({ name: 'Harness Co', phone: '0771234567', wants: 'Two boxes' });
    ok('an enquiry lands in Waiting', data.waiting().length === 1 && data.waiting()[0].id === e.id);
    const d = await data.convertEnquiry(e);
    ok('Start moves it to the pipeline and keeps the link both ways', d.enquiryId === e.id && data.enquiries()[0].dealId === d.id && data.enquiries()[0].status === 'converted' && data.waiting().length === 0);
    await data.updateDeal(d.id, { value: 5000 });
    await data.moveDeal(d.id, 'quoted');
    ok('a stage move is weighted by the cast probability', data.openDeals().length === 1 && Math.round(data.weighted()) === Math.round(5000 * (c.stages.find(s => s.key === 'quoted')!.prob / 100)));
    await data.moveDeal(d.id, 'won'); await data.moveDeal(d.id, 'won');
    ok('winning makes exactly one customer carrying what they bought and the value', data.customers().length === 1 && data.customers()[0].bought === 'Two boxes' && data.customers()[0].value === 5000 && data.openDeals().length === 0);
    ok('won this month counts it', data.wonThisMonth().length === 1 && data.wonValueThisMonth() === 5000);
    ok('activity trail grew on every move', data.activityFor(d.id).length >= 3);
    await data.removeDeal(d.id);
    ok('the cast carries no lead, customer or phone list', !/"(leads|deals|customers)"\s*:\s*\[/.test(JSON.stringify(c)));
  } finally {
    if (real === null) localStorage.removeItem('bbos_' + c.slug); else localStorage.setItem('bbos_' + c.slug, real);
    await data.reload();
  }
  } else if (c) { ok('api mode: rows live on the server, the harness never writes into a client book', data.mode() === 'api', 'mode ' + data.mode()); }
  const pass = T.filter(t => t[0]).length;
  console.log(`BBOS SELFTEST: ${pass}/${T.length} passed`);
  T.forEach(t => console.log((t[0] ? 'PASS ' : 'FAIL ') + t[1] + (t[2] ? ' (' + t[2] + ')' : '')));
  return { pass, total: T.length, fails: T.filter(t => !t[0]).map(t => t[1]) };
}
function inScroller(e: Element){ let p = e.parentElement; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return true; p = p.parentElement; } return false; }

import { CastService } from './cast.service';
import { DataService, waLink } from './data.service';

/* ?selftest runs the harness on THIS cast in THIS browser and prints one line per
   check. It uses a throwaway store key so a client's real rows are never touched,
   and it restores the real store when it is done. A check that cannot find its
   target FAILS; nothing here passes by being unable to look. */
export async function runSelftest(cast: CastService, data: DataService){
  const T: [boolean, string, string][] = [];
  const ok = (name: string, pass: boolean, note = '') => T.push([!!pass, name, note]);
  const c = cast.cast()!;
  const cs = getComputedStyle(document.documentElement);
  ok('cast loaded with slug, name, wa and a brand hex', !!c.slug && !!c.name && /^94\d{9}$/.test(c.wa) && /^#[0-9a-f]{6}$/i.test(c.brand.hex));
  ok('palette derived from the one brand hex', cs.getPropertyValue('--brand').trim().toLowerCase() === c.brand.hex.toLowerCase() && cs.getPropertyValue('--brand-soft').trim() !== '');
  ok('manifest swapped per tenant', ((document.getElementById('manifest') as HTMLLinkElement)?.href || '').includes(encodeURIComponent(c.slug)));
  ok('viewport covers the notch', /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]')?.getAttribute('content') || ''));
  ok('safe area variables in use', cs.getPropertyValue('--sat') !== '' && !!document.querySelector('.statusfill'));
  ok('no field under 16px on a coarse pointer', (() => { const s = document.createElement('style'); s.textContent = ''; const q = matchMedia('(pointer:coarse)').matches; if (!q) return true; return [...document.querySelectorAll('input,select,textarea')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16); })());
  ok('no emoji glyph in page text', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.body.innerText));
  ok('no em or en dash in copy', !/[—–]/.test(document.body.innerText));
  ok('no comma before and, or, but or nor', !/,\s+(and|or|but|nor)\b/i.test(document.body.innerText));
  ok('nothing clipped off the right edge', [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && getComputedStyle(e).visibility !== 'hidden' && !inScroller(e)).length === 0);
  const desk = innerWidth >= 1020;
  const rail = document.querySelector('.rail') as HTMLElement | null;
  const tabs = document.querySelector('.tabs') as HTMLElement | null;
  if (rail && tabs) {
    ok('nav matches width: rail on desk, tab bar on phone', desk ? getComputedStyle(rail).visibility !== 'hidden' && getComputedStyle(tabs).display === 'none' : getComputedStyle(tabs).display !== 'none', innerWidth + 'px');
    ok('rail carries two groups, Library and Sales, with a divider', document.querySelectorAll('.rail .grp').length === 2 && !!document.querySelector('.rail hr.div'));
    ok('the other system starts collapsed', document.querySelectorAll('.rail .grp.off').length === 1);
    ok('every icon is a stroke svg, none an image or emoji', [...document.querySelectorAll('bb-icon svg')].length > 0 && [...document.querySelectorAll('.rail nav a')].every(a => a.querySelector('svg')));
    ok('tap targets in the rail and tab bar are 40px or taller', [...document.querySelectorAll('.rail nav a, .tabs a')].filter(a => a.getBoundingClientRect().height > 0).every(a => a.getBoundingClientRect().height >= 40));
  } else {
    /* no shell on this screen: it must be the door or the launcher, and each has its own anatomy */
    const door = document.querySelector('.login-card'), doors = document.querySelectorAll('.door');
    ok('a screen without the shell is the door or the launcher', !!door || doors.length === 2, door ? 'login' : doors.length + ' doors');
    ok('the door lists every cast user and one PIN field', !door || (document.querySelectorAll('.who button').length === (c.users || []).length && !!document.getElementById('pin')));
    ok('the PIN field cannot zoom the page on a phone', !door || parseFloat(getComputedStyle(document.getElementById('pin')!).fontSize) >= (matchMedia('(pointer:coarse)').matches ? 16 : 14));
    ok('the launcher offers exactly two doors, Library and Sales', !!door || (doors.length === 2 && /library/i.test(doors[0].textContent || '') && /sales/i.test(doors[1].textContent || '')));
    ok('sign in and the doors are 44px or taller', [...document.querySelectorAll('.login-card .btn, .who button, .door')].every(a => a.getBoundingClientRect().height >= 44));
  }
  ok('a local number becomes a real WhatsApp link', waLink('0771234567', 'X') === 'https://wa.me/94771234567?text=Hello%20X%2C%20' && waLink('', 'X') === '');
  /* behaviour, on a throwaway store */
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
  const pass = T.filter(t => t[0]).length;
  console.log(`BBOS SELFTEST: ${pass}/${T.length} passed`);
  T.forEach(t => console.log((t[0] ? 'PASS ' : 'FAIL ') + t[1] + (t[2] ? ' (' + t[2] + ')' : '')));
  return { pass, total: T.length, fails: T.filter(t => !t[0]).map(t => t[1]) };
}
function inScroller(e: Element){ let p = e.parentElement; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return true; p = p.parentElement; } return false; }

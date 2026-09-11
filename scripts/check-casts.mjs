#!/usr/bin/env node
/* Refuses any cast that carries what a cast must never carry. The repo is public,
 * so a cast is a public file: brand, words, stages and library METADATA only.
 * A cast that carries a lead, a customer, a phone list, a key or a secret fails
 * the build. Same law as bb-client-library/scripts/check-casts.py. */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve(process.cwd(), 'casts');
const FORBIDDEN_KEYS = ['leads', 'enquiryRows', 'customersRows', 'deals', 'contacts', 'pinHash', 'serviceRole', 'service_role', 'anonKey', 'apiKey', 'secret', 'token'];
const REQUIRED = ['slug', 'name', 'bb', 'brand', 'words', 'stages', 'library', 'aliases', 'data'];
let bad = 0, n = 0;

function walk(o, trail, hits){
  if(Array.isArray(o)){ o.forEach((v, i) => walk(v, trail + '[' + i + ']', hits)); return; }
  if(o && typeof o === 'object'){
    for(const k of Object.keys(o)){
      /* a forbidden NAME is a leak only when it holds data. words.deals = "Deals"
         is a label and allowed; deals: [...] is a customer list and refused */
      if(FORBIDDEN_KEYS.includes(k) && (typeof o[k] === 'object' || /key|secret|token|role/i.test(k))) hits.push(trail + '.' + k);
      walk(o[k], trail + '.' + k, hits);
    }
  }
}
for(const f of (await readdir(DIR)).filter(f => f.endsWith('.json'))){
  n++;
  const cast = JSON.parse(await readFile(path.join(DIR, f), 'utf8'));
  const problems = [];
  for(const k of REQUIRED) if(!(k in cast)) problems.push('missing ' + k);
  if(cast.slug !== f.replace('.json', '')) problems.push('slug does not match file name');
  if(!/^#[0-9a-f]{6}$/i.test(cast.brand?.hex || '')) problems.push('brand.hex is not a six digit hex');
  if(!/^94\d{9}$/.test(cast.bb?.wa || '')) problems.push('bb.wa (the Business Booster line this client messages) is not a 94 number');
  if(cast.wa && !/^94\d{9}$/.test(cast.wa)) problems.push('wa (the client\'s own line) is not a 94 number');
  if(cast.wa && cast.wa === cast.bb?.wa) problems.push('bb.wa equals the client\'s own line: the Message BB button would message the client');
  /* a WhatsApp group invite is a key to a private group: never in a public file */
  if(/chat\.whatsapp\.com/i.test(JSON.stringify(cast))) problems.push('a WhatsApp group invite link is in a committed cast: pass it to onboard.mjs --group instead');
  if(!['local','api'].includes(cast.data?.mode)) problems.push('data.mode must be local or api');
  if(cast.pin && cast.data?.mode === 'api') problems.push('an api cast must not carry a pin: seats live on the server');
  const hits = []; walk(cast, 'cast', hits);
  if(hits.length) problems.push('forbidden keys: ' + hits.join(', '));
  /* a phone number anywhere outside the client's own wa is a leak */
  const text = JSON.stringify({ ...cast, wa: '', bb: { ...(cast.bb || {}), wa: '' } });
  const phones = (text.match(/\b0?7\d[\d\s-]{7,}\b/g) || []).filter(p => p.replace(/\D/g, '').length >= 9);
  if(phones.length) problems.push('phone numbers in cast: ' + phones.join(', '));
  const links = (text.match(/https?:\/\/[^"\s]+/g) || []).filter(u => !u.startsWith('https://'));
  if(links.length) problems.push('non-https links: ' + links.join(', '));
  if(problems.length){ bad++; console.log('FAIL ' + f + '\n  ' + problems.join('\n  ')); }
  else console.log('ok   ' + f);
}
console.log(bad ? `RESULT: ${bad} of ${n} casts FAIL` : `RESULT: ALL GREEN (${n} casts)`);
process.exit(bad ? 1 : 0);

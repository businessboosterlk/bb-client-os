import { readFile } from 'node:fs/promises';
import path from 'node:path';

/* A cast is the ONLY thing that differs between clients. It lives in casts/<slug>.json
 * at the repo root, shared by the API and the Angular build. A cast carries brand,
 * words and library METADATA. It never carries a lead, a customer or a phone number:
 * scripts/check-casts.mjs refuses one that does. */
const ROOT = path.resolve(process.cwd(), '..', '..', 'casts');
const SLUG = /^[a-z0-9-]{2,40}$/;

export async function loadCast(slug){
  if(!SLUG.test(slug)) return null;
  try{
    const raw = await readFile(path.join(ROOT, slug + '.json'), 'utf8');
    return JSON.parse(raw);
  }catch(e){ return null; }
}

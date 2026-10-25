/* THE PRIVATE FILE STORE (Stage 2). Photos, voice notes and post artwork are files, never text inside a row. Database mode:
   the bucket is private with no storage policies, so nothing opens without a link this server signs after checking the
   file belongs to the signed in client. Memory mode keeps the bytes in this process behind the same kind of signed link. */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mode, supa } from './store.js';

const BUCKET = process.env.HUB_MEDIA_BUCKET || 'hub-media';
import { SECRET as SESSION } from './auth.js';
const SECRET = SESSION || 'dev-only-secret';

export async function signUpload(slug, id, path, mime) {
  if (mode === 'supabase') {
    const { data, error } = await (await supa()).storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;
    return { url: data.signedUrl, path: data.path, token: data.token };
  }
  return { url: rawLink(slug, id, 600), path };
}

export async function signView(slug, file) {
  if (mode === 'supabase') {
    const { data, error } = await (await supa()).storage.from(BUCKET).createSignedUrl(file.path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }
  return rawLink(slug, file.id, 3600);
}

export function rawLink(slug, id, seconds) {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  const sig = createHmac('sha256', SECRET).update(slug + '|' + id + '|' + exp).digest('base64url');
  return `/api/${slug}/work/files/${id}/raw?exp=${exp}&sig=${sig}`;
}

export async function rawPut(req, slug, id) {
  if (mode === 'supabase') return Response.json({ error: 'Not found' }, { status: 404 });
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') || '';
  const expected = createHmac('sha256', SECRET).update(slug + '|' + id + '|' + exp).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b) || exp < Math.floor(Date.now() / 1000)) {
    return Response.json({ error: 'This link has run out' }, { status: 403 });
  }
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length > 5242880) return Response.json({ error: 'That file is too large' }, { status: 413 });
  const map = (globalThis.__hubFiles ||= new Map());
  map.set(slug + '/' + id, { type: req.headers.get('content-type') || 'application/octet-stream', bytes });
  return Response.json({ ok: true });
}

export async function rawGet(req, slug, id) {
  if (mode === 'supabase') return Response.json({ error: 'Not found' }, { status: 404 });
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') || '';
  const expected = createHmac('sha256', SECRET).update(slug + '|' + id + '|' + exp).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b) || exp < Math.floor(Date.now() / 1000)) {
    return Response.json({ error: 'This link has run out' }, { status: 403 });
  }
  const entry = (globalThis.__hubFiles ||= new Map()).get(slug + '/' + id);
  if (!entry) return Response.json({ error: 'Not found' }, { status: 404 });
  return new Response(entry.bytes, { headers: { 'Content-Type': entry.type, 'Cache-Control': 'private, max-age=3600' } });
}

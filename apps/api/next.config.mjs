/** BB Client OS API. Next.js is used for its API routes; the pages are the Angular app in apps/web, per
 *  ~/bb-systems/STACK-STANDARD.md. On Railway (25 Oct 2026) ONE service serves both: the Angular build is copied into public/
 *  by scripts/deploy-railway.sh, and the root address opens it. One address means the app never calls across sites.
 *  Who may call from another site (the panel inside the SMM Workspace and the Command Centre) is decided in middleware.js.
 *
 *  SECURITY HEADERS (kit, 11 Nov 2026). Two policies from lib/kit/headers.js:
 *   - every answer under /api gets the strict API policy (it serves JSON, nothing may load or frame it);
 *   - the pages get an app policy that lets the Angular build run and nothing more: its own scripts, styles and fonts,
 *     the Supabase live channel (wss) and signed file links (https), blob: and data: pictures and voice notes.
 *     The build has one inline script (the theme, chosen before first paint) and Angular's onload that switches the
 *     stylesheet on. Both are allowed by their sha256 hash, read from the built index.html when this config loads,
 *     so a rebuilt page brings its own hash. No 'unsafe-eval', no 'unsafe-inline' for scripts.
 *  Next applies the LAST matching rule for a header, so the /api rule comes after the page rule. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { securityHeaders } from './lib/kit/headers.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha = s => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;

/* the page that is served: public/ on Railway, else the local build, else the source */
function pageHashes() {
  const tries = ['public/index.html', '../web/dist/web/browser/index.html', '../web/src/index.html'].map(p => path.join(HERE, p));
  const file = tries.find(f => fs.existsSync(f));
  const html = file ? fs.readFileSync(file, 'utf8') : '';
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
  const handlers = [...html.matchAll(/\son[a-z]+="([^"]*)"/gi)].map(m => m[1]);
  handlers.push("this.media='all'");                     /* Angular's stylesheet switch, even when the page was not found */
  return { scripts: [...new Set(scripts.map(sha))], handlers: [...new Set(handlers.map(sha))] };
}

function supabaseHosts() {
  const list = ['https://*.supabase.co', 'wss://*.supabase.co'];
  try {
    const u = new URL(process.env.SUPABASE_URL || '');
    if (!/\.supabase\.co$/.test(u.hostname)) list.push(u.origin, u.origin.replace(/^http/, 'ws'));
  } catch { /* no address set: the wildcard covers a Supabase project */ }
  return list;
}

function appCsp() {
  const h = pageHashes(), supa = supabaseHosts();
  const https = supa.filter(s => s.startsWith('https:'));
  return [
    "default-src 'self'",
    ["script-src 'self'", ...h.scripts, ...(h.handlers.length ? ["'unsafe-hashes'", ...h.handlers] : [])].join(' '),
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data: blob:", ...https].join(' '),
    ["media-src 'self' blob:", ...https].join(' '),
    "font-src 'self'",
    ["connect-src 'self'", ...supa].join(' '),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/* voice notes record with the microphone (apps/web core/media.ts), so the page may ask for it; nothing else */
const PAGE_PERMISSIONS = 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()';

const nextConfig = {
  poweredByHeader: false,
  async rewrites(){ return [{ source: '/', destination: '/index.html' }]; },
  async headers(){ return [
    { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    { source: '/(index.html|sw.js|version.json|config.json)', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    { source: '/:path*', headers: securityHeaders({ csp: appCsp(), permissions: PAGE_PERMISSIONS }) },
    { source: '/api/:path*', headers: securityHeaders({ isApi: true }) }
  ]; }
};
export default nextConfig;

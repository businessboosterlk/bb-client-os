/** BB Client OS API. Next.js is used for its API routes; the pages are the Angular app in apps/web, per
 *  ~/bb-systems/STACK-STANDARD.md. On Railway (25 Oct 2026) ONE service serves both: the Angular build is copied into public/
 *  by scripts/deploy-railway.sh, and the root address opens it. One address means the app never calls across sites.
 *  Who may call from another site (the panel inside the SMM Workspace and the Command Centre) is decided in middleware.js. */
const nextConfig = {
  async rewrites(){ return [{ source: '/', destination: '/index.html' }]; },
  async headers(){ return [
    { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    { source: '/(index.html|sw.js|version.json|config.json)', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }
  ]; }
};
export default nextConfig;

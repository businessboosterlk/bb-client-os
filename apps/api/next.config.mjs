/** BB Client OS API. Next.js is used for its API routes only: the pages layer is the
 *  Angular app in apps/web, per ~/bb-systems/STACK-STANDARD.md. CORS is open to the
 *  Angular dev server and the GitHub Pages origin, nothing else. */
const ORIGINS = (process.env.HUB_ORIGINS || 'http://localhost:8761,https://businessboosterlk.github.io').split(',');
const nextConfig = {
  async headers(){
    return [{
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: ORIGINS[0] },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-BB-Admin' }
      ]
    }];
  }
};
export default nextConfig;

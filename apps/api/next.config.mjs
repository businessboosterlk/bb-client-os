/** BB Client OS API. Next.js is used for its API routes only: the pages layer is the
 *  Angular app in apps/web, per ~/bb-systems/STACK-STANDARD.md. CORS is open to the
 *  Angular dev server and the GitHub Pages origin, nothing else. */
const ORIGINS = [
  'http://localhost:4200',
  'http://localhost:8761',
  'https://businessboosterlk.github.io'
];
const nextConfig = {
  async headers(){
    return [{
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: ORIGINS.join(', ') },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-BB-Client' }
      ]
    }];
  }
};
export default nextConfig;

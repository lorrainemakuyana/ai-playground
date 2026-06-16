/** @type {import('next').NextConfig} */

// Workbox routes default to GET only, so a single rule would leave POST/PATCH/etc.
// (e.g. the /api/auth/login POST) to fall through to a default handler that, on
// mobile PWAs, could intercept the request and never settle respondWith — the
// login button then spins forever. Register an explicit NetworkOnly route per
// method so every /api request always goes straight to the network.
const apiNetworkOnly = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => ({
  // Workbox matches against the full URL, so don't use a ^ anchor.
  // This covers all requests whose path starts with /api/.
  urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
  handler: 'NetworkOnly',
  method,
}))

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  // The start_url ('/app') is auth-gated and 307-redirects to /auth when logged
  // out. Caching it (the default) poisons navigations on mobile, where the
  // service worker persists across visits and serves the stale redirect.
  cacheStartUrl: false,
  dynamicStartUrl: false,
  workboxOptions: {
    disableDevLogs: true,
    // Auth-gated routes and the API must always hit the network so the cookie /
    // redirect logic runs fresh — never serve them from a navigation fallback.
    navigateFallbackDenylist: [/^\/api\//, /^\/auth/, /^\/app/],
    runtimeCaching: apiNetworkOnly,
  },
})

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/:path*`,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)

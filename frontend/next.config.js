/** @type {import('next').NextConfig} */
// Browser requests hit the same-origin `/api/*` path, which this rewrite proxies
// to the backend. The backend origin is configurable so production deployments
// can point at their real API host instead of localhost.
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
}
module.exports = nextConfig

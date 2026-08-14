/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app has no backend — no route handlers, no server actions, no database.
  // Every screen is derived at module load from the seeded data in lib/data/, so
  // there is nothing for a server to decide at request time. Exporting to plain
  // HTML lets Cloudflare serve the whole site from its asset edge instead of
  // running a Worker render per request, which was intermittently returning 503
  // (free-plan resource limits) under Next's link prefetching.
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

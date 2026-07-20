/* The Vercel deployment hosts the frontend but delegates every /api call to the always-on
   Alibaba Cloud ECS backend (real disk, live Qwen Cloud), so the public HTTPS URL runs the full
   create → telling → recall loop against the durable store. The proxy is a server-side rewrite:
   the browser only ever talks to the HTTPS Vercel origin (no mixed content, no raw-IP link).
   It activates ONLY on Vercel (or when TROVE_API_PROXY_ORIGIN is set) so the ECS build — which
   serves this same repo — never proxies its own /api back to itself. */
const API_PROXY_ORIGIN =
  process.env.TROVE_API_PROXY_ORIGIN ||
  (process.env.VERCEL ? 'http://47.84.113.80:3009' : '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle — portable to any Node host (Alibaba Cloud ECS / SAS, a container, etc.).
  output: 'standalone',
  reactStrictMode: true,
  devIndicators: false,
  // The memory store uses the Node runtime (filesystem / Postgres), never the Edge runtime.
  serverExternalPackages: ['pg'],
  async rewrites() {
    if (!API_PROXY_ORIGIN) return [];
    // beforeFiles: intercept /api before the local route handlers so the whole API is served by
    // the durable ECS backend rather than this deployment's own (storeless on Vercel) handlers.
    return {
      beforeFiles: [
        { source: '/api/:path*', destination: `${API_PROXY_ORIGIN}/api/:path*` },
      ],
    };
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;

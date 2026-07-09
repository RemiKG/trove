/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle — portable to any Node host (Alibaba Cloud ECS / SAS, a container, etc.).
  output: 'standalone',
  reactStrictMode: true,
  devIndicators: false,
  // The memory store uses the Node runtime (filesystem / Postgres), never the Edge runtime.
  serverExternalPackages: ['pg'],
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

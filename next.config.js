// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', 'C:\\DumpStack.log.tmp', 'C:\\pagefile.sys'],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
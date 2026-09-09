import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Puppeteer/Chromium traen binarios nativos; deben quedar fuera del bundle de webpack y resolverse via require en runtime.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  }
};

export default nextConfig;
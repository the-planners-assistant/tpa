/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  output: 'export',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@tpa/ui'],
  webpack: (config, { isServer }) => {
    // Fix for pdfjs-dist and DOMMatrix issues
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        stream: false,
        crypto: false,
      };
    }
    
    // Handle pdfjs-dist worker
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist/build/pdf.worker.entry': 'pdfjs-dist/build/pdf.worker.min.js',
    };

    return config;
  },
}

module.exports = nextConfig

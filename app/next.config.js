/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Enable SWC minification for better performance
  swcMinify: true,
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
  },

  // Enhanced webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Existing fallbacks for Node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }

    // Optimize bundle splitting
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            // Solana SDK chunk
            solana: {
              test: /[\\/]node_modules[\\/](@solana|@coral-xyz)[\\/]/,
              name: 'solana',
              chunks: 'all',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Metaplex chunk
            metaplex: {
              test: /[\\/]node_modules[\\/]@metaplex-foundation[\\/]/,
              name: 'metaplex',
              chunks: 'all',
              priority: 15,
              reuseExistingChunk: true,
            },
            // React ecosystem chunk
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
            // UI libraries chunk
            ui: {
              test: /[\\/]node_modules[\\/](framer-motion|react-hot-toast)[\\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 8,
              reuseExistingChunk: true,
            },
            // Utilities chunk
            utils: {
              test: /[\\/]node_modules[\\/](lodash|date-fns|crypto-js)[\\/]/,
              name: 'utils',
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
            },
            // Common vendor chunk for other dependencies
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              chunks: 'all',
              priority: 1,
              reuseExistingChunk: true,
            },
          },
        },
      }
    }

    // Tree shaking for better bundle size
    config.optimization.usedExports = true
    config.optimization.sideEffects = false

    // Bundle analyzer in development
    if (process.env.ANALYZE) {
      const BundleAnalyzerPlugin = require('@next/bundle-analyzer')({
        enabled: true,
      })
      config.plugins.push(new BundleAnalyzerPlugin())
    }

    return config
  },

  // Headers for better caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  // Compress responses
  compress: true,

  // PoweredBy header removal
  poweredByHeader: false,

  // Generate standalone output for better deployment
  output: 'standalone',

  // Disable TypeScript and ESLint checks during build
  typescript: {
    ignoreBuildErrors: true,
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Railway configuration
  output: 'standalone',
  
  // Ensure proper asset handling
  trailingSlash: false,
  
  // Optimize for production
  compress: true,
  
  // Ensure static assets are properly served
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  
  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
  },
  
  // Ensure proper image optimization
  images: {
    unoptimized: false,
  },
}

module.exports = nextConfig

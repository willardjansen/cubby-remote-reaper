/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Electron packaging
  output: 'export',

  // Disable image optimization for static export
  images: {
    unoptimized: true
  },

  // Trailing slash for static file serving
  trailingSlash: true
}

module.exports = nextConfig

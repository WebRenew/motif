import pkg from "workflow/next"
const { withWorkflow } = pkg

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  compiler: {
    // Remove console.log/debug from client bundles in production, keep error/warn/info
    // Server-side logs are unaffected - they go to Vercel
    removeConsole: process.env.NODE_ENV === 'production' 
      ? { exclude: ['error', 'warn', 'info'] }
      : false,
  },
  experimental: {
    // Optimize barrel imports to reduce bundle size
    optimizePackageImports: ['lucide-react', '@xyflow/react'],
  },
}

export default withWorkflow(nextConfig)

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
    removeConsole: true,
  },
  experimental: {
    // Optimize barrel imports to reduce bundle size
    optimizePackageImports: ['lucide-react', '@xyflow/react'],
  },
}

export default withWorkflow(nextConfig)

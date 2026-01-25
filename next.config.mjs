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
}

export default withWorkflow(nextConfig)

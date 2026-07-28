import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Erzeugt .next/standalone — vom deploy/Dockerfile vorausgesetzt.
  output: 'standalone',
}

export default nextConfig


import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.vietqr.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // For Next.js 13.5+ and newer, allowedDevOrigins is a top-level property.
  // The structure `experimental: { allowedDevOrigins: [] }` is for older versions.
  allowedDevOrigins: [
    "9000-firebase-studio-1747305900470.cluster-zumahodzirciuujpqvsniawo3o.cloudworkstations.dev",
    "firebase-studio-1747305900470.cluster-zumahodzirciuujpqvsniawo3o.cloudworkstations.dev",
    "http://localhost:3000", // Default Next.js port
    "http://localhost:9002",
    "http://localhost:9003",
    "http://localhost:9004",
  ],
  experimental: {
    // Remove allowedDevOrigins from here if it was previously nested
  },
};

export default nextConfig;

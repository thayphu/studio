
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
        hostname: 'img.vietqr.io', // Corrected hostname
        port: '',
        pathname: '/**',
      },
    ],
  },
  // allowedDevOrigins should be a top-level property, not under experimental for newer Next.js versions
  allowedDevOrigins: [
    // Add your Firebase Studio / Cloud Workstations preview domain here
    "9000-firebase-studio-1747305900470.cluster-zumahodzirciuujpqvsniawo3o.cloudworkstations.dev",
    "firebase-studio-1747305900470.cluster-zumahodzirciuujpqvsniawo3o.cloudworkstations.dev",
    // Add any other origins you use for development, e.g., localhost if IDX exposes it that way
    "http://localhost:3000", // Default Next.js port
    "http://localhost:9002", // Port from previous logs
    "http://localhost:9003", // Port from previous logs
    "http://localhost:9004", // Port from previous logs
  ],
  experimental: {
    // Keep other experimental features if any, but allowedDevOrigins is moved
  },
};

export default nextConfig;


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
  experimental: {
    allowedDevOrigins: [
      // Add your Firebase Studio / Cloud Workstations preview domain here
      // Example based on your error log. You might need to adjust the port or ensure
      // the base domain is covered if the port is dynamic.
      "9000-firebase-studio-1747305900470.cluster-zumahodzirciuujpqvsniawo3o.cloudworkstations.dev",
      // It might be safer to add the base domain if the port or prefix changes often
      "firebase-studio-1747305900470.cluster-zumahodzirciuujpqvsniawo3o.cloudworkstations.dev",
    ],
  },
};

export default nextConfig;

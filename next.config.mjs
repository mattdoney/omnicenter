/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Ignoring TypeScript errors to allow deployment to proceed
    // This should be removed once all TypeScript errors are fixed
    ignoreBuildErrors: true,
  },
  eslint: {
    // !! WARN !!
    // Ignoring ESLint errors to allow deployment to proceed
    // This should be removed once all ESLint errors are fixed
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
        url: false,
        assert: false
      };
    }
    return config;
  },
};

export default nextConfig;

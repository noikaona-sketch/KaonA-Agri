/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Warnings don't block production builds
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;

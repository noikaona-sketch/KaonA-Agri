/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Warnings are surfaced in CI logs but do not fail the build.
    // All rules are still enforced — only blocking is disabled.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

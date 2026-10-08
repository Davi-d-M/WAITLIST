/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;

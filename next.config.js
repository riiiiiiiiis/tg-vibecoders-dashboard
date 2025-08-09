/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Reduce dev-time instability from HMR when doing heavy code moves
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

module.exports = nextConfig;



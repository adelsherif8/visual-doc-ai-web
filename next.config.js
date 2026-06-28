/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // tesseract.js loads a worker + WASM at runtime — keep it out of the webpack
  // bundle so it resolves from node_modules in the serverless function.
  experimental: {
    serverComponentsExternalPackages: ["tesseract.js"],
  },
};

module.exports = nextConfig;

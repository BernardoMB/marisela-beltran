import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This project lives inside the artist-site-factory repository; pin the workspace root to this folder.
  outputFileTracingRoot: projectRoot,
  eslint: { ignoreDuringBuilds: true },
  images: { formats: ["image/avif", "image/webp"] },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;

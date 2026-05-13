import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const demoRoot = dirname(fileURLToPath(import.meta.url));
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig = {
  output: "export",
  trailingSlash: true,
  turbopack: {
    root: demoRoot,
  },
  ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.foursquare.com",
      },
      {
        protocol: "https",
        hostname: "*.4sqi.net",
      },
    ],
  },
};

export default nextConfig;

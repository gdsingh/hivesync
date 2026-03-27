/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
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

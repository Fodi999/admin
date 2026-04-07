import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://ministerial-yetta-fodi999-c58d8823.koyeb.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-aca11a32217e46129dd78b17f017d0a1.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.postimg.cc",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "pub-85f883ab.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.dima-fomin.pl",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

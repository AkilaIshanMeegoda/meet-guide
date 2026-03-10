import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-src 'self' https://meet.awdspark.com http://meet.awdspark.com; frame-ancestors 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
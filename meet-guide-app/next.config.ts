import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Required for AWS Amplify deployment
  /* config options here */
};

export default nextConfig;

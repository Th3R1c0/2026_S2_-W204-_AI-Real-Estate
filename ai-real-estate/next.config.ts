import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "mediaserver.realestate.co.nz" },
      { protocol: "https", hostname: "s.oneroof.co.nz" },
      { protocol: "https", hostname: "s3-ap-southeast-2.amazonaws.com" },
      { protocol: "https", hostname: "homes-listing-images.s3.ap-southeast-2.amazonaws.com" },
      { protocol: "https", hostname: "images.corelogic.asia" },
    ],
  },
};

export default nextConfig;

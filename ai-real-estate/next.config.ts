import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  },
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

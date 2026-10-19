import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  compress: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "mediaserver.realestate.co.nz" },
      { protocol: "https", hostname: "s.oneroof.co.nz" },
      { protocol: "https", hostname: "s3-ap-southeast-2.amazonaws.com" },
      { protocol: "https", hostname: "homes-listing-images.s3.ap-southeast-2.amazonaws.com" },
      { protocol: "https", hostname: "images.corelogic.asia" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "radix-ui",
      "@vis.gl/react-google-maps",
    ],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;

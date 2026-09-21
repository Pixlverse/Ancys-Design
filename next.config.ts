import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The invoice fonts are read from disk at request time, so they have to be
  // traced into the serverless bundle — nothing imports them, so Next cannot
  // infer them.
  outputFileTracingIncludes: {
    "/api/orders/[id]/invoice": ["./assets/fonts/**"],
  },
};

export default nextConfig;

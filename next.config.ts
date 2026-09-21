import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The invoice fonts are read from disk at request time, so they have to be
  // traced into the serverless bundle — nothing imports them, so Next cannot
  // infer them.
  outputFileTracingIncludes: {
    // pdfkit (under @react-pdf/renderer) requires its standard fonts lazily at
    // render time, so static analysis never sees them and they were dropped
    // from the serverless bundle. On Netlify that surfaced as an *unhandled
    // rejection* — "Cannot find module … pdfkit/js/standard-fonts/Helvetica.cjs"
    // — which kills the whole Lambda instance, taking unrelated requests on
    // that instance down with it.
    "/api/orders/[id]/invoice": [
      "./assets/fonts/**",
      "./node_modules/pdfkit/js/standard-fonts/**",
    ],
    "/api/reports/monthly": [
      "./assets/fonts/**",
      "./node_modules/pdfkit/js/standard-fonts/**",
    ],
  },
};

export default nextConfig;

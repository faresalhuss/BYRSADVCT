import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas", "sharp", "heic-convert"],
  // pdf.js loads its fallback fonts from disk at runtime; file tracing cannot see those reads.
  outputFileTracingIncludes: {
    "/api/attachments/**": ["./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/standard_fonts/**"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Long-lived cache for the immutable hex dataset. The file is only
        // regenerated when the pipeline runs; a filename-content hash would
        // be nicer, but static /public assets can't be hashed without a CDN
        // layer, so we rely on strong ETag + max-age.
        source: "/data/hex_compact.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/data/:path*.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
  transpilePackages: [
    "@deck.gl/core",
    "@deck.gl/layers",
    "@deck.gl/geo-layers",
    "@deck.gl/extensions",
    "@deck.gl/mapbox",
    "@luma.gl/core",
    "@luma.gl/engine",
    "@luma.gl/webgl",
    "@luma.gl/shadertools",
    "@math.gl/core",
    "@math.gl/web-mercator",
    "@loaders.gl/core",
    "@loaders.gl/loader-utils",
  ],
  webpack: (config) => {
    // Prevent webpack from trying to hash WASM modules from h3-js/luma.gl
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;

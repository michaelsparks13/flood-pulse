import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

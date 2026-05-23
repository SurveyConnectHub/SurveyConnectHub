import fs from "fs";
import path from "path";

const projectRoot = fs.realpathSync(process.cwd());

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      react: path.resolve(projectRoot, "node_modules/react"),
      "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(
        projectRoot,
        "node_modules/react/jsx-runtime",
      ),
      "react/jsx-dev-runtime": path.resolve(
        projectRoot,
        "node_modules/react/jsx-dev-runtime",
      ),
    };
    return config;
  },
};

export default nextConfig;

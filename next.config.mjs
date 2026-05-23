import fs from "fs";

const projectRoot = fs.realpathSync(process.cwd());

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  webpack: (config) => config,
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ocafy/api", "@ocafy/core", "@ocafy/db", "@ocafy/ui"],
  // Os pacotes do workspace importam "./x.js" apontando para arquivos .ts (ESM/NodeNext).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;

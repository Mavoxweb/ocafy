/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ocafy/api", "@ocafy/core", "@ocafy/db", "@ocafy/ui"],
  // @neondatabase/serverless e drizzle rodam só no servidor (route handler).
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default nextConfig;

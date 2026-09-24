import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@ocafy/api", "@ocafy/core", "@ocafy/db", "@ocafy/ui"],
  // @neondatabase/serverless roda só no servidor (route handler).
  serverExternalPackages: ["@neondatabase/serverless"],
  // Monorepo: o trace de arquivos da Vercel precisa enxergar os pacotes do workspace.
  outputFileTracingRoot: path.join(here, "../.."),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

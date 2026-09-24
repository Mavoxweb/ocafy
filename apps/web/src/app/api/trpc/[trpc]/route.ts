import { auth } from "@/lib/auth/server";
import { appRouter } from "@ocafy/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    // A identidade vem SEMPRE da sessão (cookie); o cliente nunca informa userId.
    createContext: async () => {
      const { data } = await auth.getSession();
      return { userId: data?.user?.id ?? null };
    },
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[trpc] ${path ?? "?"}:`, error);
      }
    },
  });

export { handler as GET, handler as POST };

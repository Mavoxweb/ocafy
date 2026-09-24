import { initTRPC } from "@trpc/server";
import { z } from "zod";

export interface Context {
  userId?: string;
  householdId?: string;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

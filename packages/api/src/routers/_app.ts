import { publicProcedure, router } from "../trpc.js";
import { householdRouter } from "./household.js";
import { mealsRouter } from "./meals.js";
import { socialRouter } from "./social.js";
import { storeRouter } from "./store.js";
import { tasksRouter } from "./tasks.js";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),
  household: householdRouter,
  tasks: tasksRouter,
  meals: mealsRouter,
  store: storeRouter,
  social: socialRouter,
});

export type AppRouter = typeof appRouter;

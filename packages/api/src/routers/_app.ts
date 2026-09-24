import { publicProcedure, router } from "../trpc";
import { householdRouter } from "./household";
import { litterRouter } from "./litter";
import { mealsRouter } from "./meals";
import { officeRouter } from "./office";
import { socialRouter } from "./social";
import { storeRouter } from "./store";
import { tasksRouter } from "./tasks";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),
  household: householdRouter,
  tasks: tasksRouter,
  meals: mealsRouter,
  litter: litterRouter,
  office: officeRouter,
  store: storeRouter,
  social: socialRouter,
});

export type AppRouter = typeof appRouter;

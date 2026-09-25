import { publicProcedure, router } from "../trpc";
import { accountRouter } from "./account";
import { agendaRouter } from "./agenda";
import { householdRouter } from "./household";
import { litterRouter } from "./litter";
import { mealsRouter } from "./meals";
import { membersRouter } from "./members";
import { notificationsRouter } from "./notifications";
import { officeRouter } from "./office";
import { shoppingRouter } from "./shopping";
import { socialRouter } from "./social";
import { storeRouter } from "./store";
import { tasksRouter } from "./tasks";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),
  account: accountRouter,
  agenda: agendaRouter,
  household: householdRouter,
  notifications: notificationsRouter,
  tasks: tasksRouter,
  meals: mealsRouter,
  litter: litterRouter,
  members: membersRouter,
  office: officeRouter,
  store: storeRouter,
  shopping: shoppingRouter,
  social: socialRouter,
});

export type AppRouter = typeof appRouter;

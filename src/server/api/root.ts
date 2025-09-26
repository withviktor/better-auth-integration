import { createTRPCRouter } from "@/server/api/trpc";
import { serverRouter } from "@/server/api/routers/server";
import { userRouter } from "@/server/api/routers/user";
import { adminRouter } from "@/server/api/routers/admin";
import { monitoringRouter } from "@/server/api/routers/monitoring";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  server: serverRouter,
  user: userRouter,
  admin: adminRouter,
  monitoring: monitoringRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
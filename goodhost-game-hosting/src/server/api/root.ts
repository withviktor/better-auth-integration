import { router } from './trpc';
import { gameServersRouter } from './routers/gameServers.router';
import { vpsRouter } from './routers/vps.router';

export const appRouter = router({
  gameServers: gameServersRouter,
  vps: vpsRouter,
});

export type AppRouter = typeof appRouter;
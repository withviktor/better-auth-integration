import { initTRPC } from '@trpc/server';
import type { inferAsyncReturnType } from '@trpc/server';

export async function createContext() {
  return {};
}

type Context = inferAsyncReturnType<typeof createContext>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

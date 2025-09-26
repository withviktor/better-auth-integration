import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { databaseService } from '@/server/services/database.service';
import { GameHostingError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from '@/shared/types';

// Create context type
export interface Context {
  user?: {
    id: string;
    email: string;
    username: string;
    role: 'user' | 'admin' | 'moderator';
  };
  db: ReturnType<typeof databaseService.getDb>;
}

// Create context
export const createContext = (): Context => {
  return {
    db: databaseService.getDb()
  };
};

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.code,
        httpStatus: error.cause instanceof GameHostingError ? error.cause.statusCode : 500,
      },
    };
  },
});

// Base router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware for authentication
const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Now we know user exists
    },
  });
});

// Middleware for admin role
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Protected procedures
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAdmin);

// Error handling helpers
export const handleTRPCError = (error: unknown): TRPCError => {
  if (error instanceof GameHostingError) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
      cause: error,
    });
  }
  
  if (error instanceof z.ZodError) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Validation failed',
      cause: new ValidationError(error.issues.map(e => e.message).join(', ')),
    });
  }
  
  if (error instanceof Error) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
    });
  }
  
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
};

// Validation helpers
export const validateResourceLimits = (used: number, limit: number, resource: string) => {
  if (used > limit) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `${resource} limit exceeded. Used: ${used}, Limit: ${limit}`,
      cause: new ValidationError(`${resource} limit exceeded`),
    });
  }
};

export const validateServerOwnership = async (db: Context['db'], serverId: string, userId: string, serverType: 'game_server' | 'vps') => {
  if (serverType === 'game_server') {
    const server = await db.query.gameServers.findFirst({
      where: (servers, { eq, and }) => and(eq(servers.id, serverId), eq(servers.userId, userId))
    });
    
    if (!server) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Game server not found or access denied',
        cause: new NotFoundError('Game server', serverId),
      });
    }
    
    return server;
  } else {
    const vps = await db.query.vpsInstances.findFirst({
      where: (instances, { eq, and }) => and(eq(instances.id, serverId), eq(instances.userId, userId))
    });
    
    if (!vps) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'VPS instance not found or access denied',
        cause: new NotFoundError('VPS instance', serverId),
      });
    }
    
    return vps;
  }
};
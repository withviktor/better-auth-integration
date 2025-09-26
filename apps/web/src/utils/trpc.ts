import { createTRPCReact } from '@trpc/react-query';

// Untyped client to avoid cross-app type imports for now
export const trpc = createTRPCReact<any>() as any;

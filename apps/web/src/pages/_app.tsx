import type { AppProps } from 'next/app';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '../utils/trpc';

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    (trpc as any).createClient({
      links: [
        httpBatchLink({ url: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/trpc' })
      ]
    })
  );
  const TrpcProvider = (trpc as any).Provider;
  return (
    <TrpcProvider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </TrpcProvider>
  );
}

import { trpc } from '../utils/trpc';

export default function Home() {
  const utils = (trpc as any).useUtils();
  const list = (trpc as any).useQuery(['servers.list']);
  const start = (trpc as any).useMutation(['servers.start'], { onSuccess: () => utils.invalidateQueries(['servers.list']) });
  const stop = (trpc as any).useMutation(['servers.stop'], { onSuccess: () => utils.invalidateQueries(['servers.list']) });

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>GoodHost Dashboard</h1>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => start.mutate({ serverId: 'demo' })}>
          Start Demo Server
        </button>
        <button style={{ marginLeft: 8 }} onClick={() => stop.mutate({ serverId: 'demo' })}>
          Stop Demo Server
        </button>
      </div>
      <pre style={{ marginTop: 16 }}>{JSON.stringify(list.data ?? [], null, 2)}</pre>
    </main>
  );
}

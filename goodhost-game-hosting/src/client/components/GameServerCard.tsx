import { useState } from 'react';
import { trpc } from '@/client/utils/trpc';
import { 
  PlayIcon, 
  StopIcon, 
  ArrowPathIcon, 
  TrashIcon,
  ChartBarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { GameServer } from '@/shared/db/schema';

interface GameServerCardProps {
  server: GameServer;
}

export function GameServerCard({ server }: GameServerCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const utils = trpc.useUtils();

  const startServer = trpc.gameServers.startGameServer.useMutation({
    onSuccess: () => {
      utils.gameServers.getUserGameServers.invalidate();
    },
  });

  const stopServer = trpc.gameServers.stopGameServer.useMutation({
    onSuccess: () => {
      utils.gameServers.getUserGameServers.invalidate();
    },
  });

  const restartServer = trpc.gameServers.restartGameServer.useMutation({
    onSuccess: () => {
      utils.gameServers.getUserGameServers.invalidate();
    },
  });

  const deleteServer = trpc.gameServers.deleteGameServer.useMutation({
    onSuccess: () => {
      utils.gameServers.getUserGameServers.invalidate();
    },
  });

  const { data: logs } = trpc.gameServers.getServerLogs.useQuery(
    { id: server.id, tail: 50 },
    { enabled: showLogs } as any
  );

  const { data: stats } = trpc.gameServers.getServerStats.useQuery(
    { id: server.id }
  );

  const handleAction = async (action: () => Promise<any>) => {
    setIsLoading(true);
    try {
      await action();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'status-running';
      case 'stopped':
        return 'status-stopped';
      case 'starting':
        return 'status-starting';
      case 'stopping':
        return 'status-stopping';
      case 'error':
        return 'status-error';
      case 'creating':
        return 'status-creating';
      case 'deleting':
        return 'status-deleting';
      default:
        return 'status-stopped';
    }
  };

  const canStart = server.status === 'stopped' || server.status === 'error';
  const canStop = server.status === 'running';
  const canRestart = server.status === 'running';
  const canDelete = server.status !== 'deleting';

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{server.name}</h3>
          <span className={`badge ${getStatusColor(server.status)}`}>
            {server.status}
          </span>
        </div>
        {server.description && (
          <p className="text-sm text-gray-500 mt-1">{server.description}</p>
        )}
      </div>

      <div className="card-body">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Port:</span>
              <span className="ml-2 font-medium">{server.port}</span>
            </div>
            <div>
              <span className="text-gray-500">Max Players:</span>
              <span className="ml-2 font-medium">{server.maxPlayers}</span>
            </div>
            <div>
              <span className="text-gray-500">RAM:</span>
              <span className="ml-2 font-medium">{server.ram} MB</span>
            </div>
            <div>
              <span className="text-gray-500">CPU:</span>
              <span className="ml-2 font-medium">{server.cpu} cores</span>
            </div>
          </div>

          {stats && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Resource Usage</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">CPU:</span>
                  <span className="ml-1 font-medium">{stats.cpuUsage.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Memory:</span>
                  <span className="ml-1 font-medium">{stats.memoryUsage.toFixed(0)} MB</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canStart && (
              <button
                onClick={() => handleAction(() => startServer.mutateAsync({ id: server.id }))}
                disabled={isLoading}
                className="btn btn-success btn-sm"
              >
                <PlayIcon className="h-4 w-4 mr-1" />
                Start
              </button>
            )}
            {canStop && (
              <button
                onClick={() => handleAction(() => stopServer.mutateAsync({ id: server.id }))}
                disabled={isLoading}
                className="btn btn-warning btn-sm"
              >
                <StopIcon className="h-4 w-4 mr-1" />
                Stop
              </button>
            )}
            {canRestart && (
              <button
                onClick={() => handleAction(() => restartServer.mutateAsync({ id: server.id }))}
                disabled={isLoading}
                className="btn btn-secondary btn-sm"
              >
                <ArrowPathIcon className="h-4 w-4 mr-1" />
                Restart
              </button>
            )}
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="btn btn-secondary btn-sm"
            >
              <DocumentTextIcon className="h-4 w-4 mr-1" />
              Logs
            </button>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="btn btn-secondary btn-sm"
            >
              <ChartBarIcon className="h-4 w-4 mr-1" />
              Stats
            </button>
            {canDelete && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
                    handleAction(() => deleteServer.mutateAsync({ id: server.id }));
                  }
                }}
                disabled={isLoading}
                className="btn btn-danger btn-sm"
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {showLogs && logs && (
        <div className="card-footer">
          <div className="bg-black rounded-lg p-3 text-green-400 text-xs font-mono max-h-40 overflow-y-auto">
            <pre>{logs}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
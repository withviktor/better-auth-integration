import { useState } from 'react';
import { trpc } from '@/client/utils/trpc';
import { 
  PlayIcon, 
  StopIcon, 
  ArrowPathIcon, 
  TrashIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';
import { VpsInstance } from '@/shared/db/schema';

interface VpsInstanceCardProps {
  instance: VpsInstance;
}

export function VpsInstanceCard({ instance }: VpsInstanceCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [command, setCommand] = useState('');

  const utils = trpc.useUtils();

  const startVps = trpc.vps.startVpsInstance.useMutation({
    onSuccess: () => {
      utils.vps.getUserVpsInstances.invalidate();
    },
  });

  const stopVps = trpc.vps.stopVpsInstance.useMutation({
    onSuccess: () => {
      utils.vps.getUserVpsInstances.invalidate();
    },
  });

  const restartVps = trpc.vps.restartVpsInstance.useMutation({
    onSuccess: () => {
      utils.vps.getUserVpsInstances.invalidate();
    },
  });

  const deleteVps = trpc.vps.deleteVpsInstance.useMutation({
    onSuccess: () => {
      utils.vps.getUserVpsInstances.invalidate();
    },
  });

  const executeCommand = trpc.vps.executeCommand.useMutation();

  const { data: logs } = trpc.vps.getVpsLogs.useQuery(
    { id: instance.id, tail: 50 },
    { enabled: showLogs } as any
  );

  const { data: stats } = trpc.vps.getVpsStats.useQuery(
    { id: instance.id }
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

  const handleExecuteCommand = async () => {
    if (!command.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await executeCommand.mutateAsync({
        id: instance.id,
        command: command.trim().split(' ')
      });
      console.log('Command result:', result);
      setCommand('');
    } catch (error) {
      console.error('Command failed:', error);
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

  const canStart = instance.status === 'stopped' || instance.status === 'error';
  const canStop = instance.status === 'running';
  const canRestart = instance.status === 'running';
  const canDelete = instance.status !== 'deleting';

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{instance.name}</h3>
          <span className={`badge ${getStatusColor(instance.status)}`}>
            {instance.status}
          </span>
        </div>
        {instance.description && (
          <p className="text-sm text-gray-500 mt-1">{instance.description}</p>
        )}
      </div>

      <div className="card-body">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">SSH Port:</span>
              <span className="ml-2 font-medium">{instance.sshPort}</span>
            </div>
            <div>
              <span className="text-gray-500">OS:</span>
              <span className="ml-2 font-medium">{instance.operatingSystem}</span>
            </div>
            <div>
              <span className="text-gray-500">RAM:</span>
              <span className="ml-2 font-medium">{instance.ram} MB</span>
            </div>
            <div>
              <span className="text-gray-500">CPU:</span>
              <span className="ml-2 font-medium">{instance.cpu} cores</span>
            </div>
            <div>
              <span className="text-gray-500">Disk:</span>
              <span className="ml-2 font-medium">{instance.diskSpace} MB</span>
            </div>
            <div>
              <span className="text-gray-500">Root Password:</span>
              <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {instance.rootPassword}
              </span>
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
                onClick={() => handleAction(() => startVps.mutateAsync({ id: instance.id }))}
                disabled={isLoading}
                className="btn btn-success btn-sm"
              >
                <PlayIcon className="h-4 w-4 mr-1" />
                Start
              </button>
            )}
            {canStop && (
              <button
                onClick={() => handleAction(() => stopVps.mutateAsync({ id: instance.id }))}
                disabled={isLoading}
                className="btn btn-warning btn-sm"
              >
                <StopIcon className="h-4 w-4 mr-1" />
                Stop
              </button>
            )}
            {canRestart && (
              <button
                onClick={() => handleAction(() => restartVps.mutateAsync({ id: instance.id }))}
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
              onClick={() => setShowTerminal(!showTerminal)}
              className="btn btn-secondary btn-sm"
            >
              <CommandLineIcon className="h-4 w-4 mr-1" />
              Terminal
            </button>
            {canDelete && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this VPS? This action cannot be undone.')) {
                    handleAction(() => deleteVps.mutateAsync({ id: instance.id }));
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

      {showTerminal && (
        <div className="card-footer">
          <div className="bg-black rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-green-400 text-sm">$</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleExecuteCommand()}
                placeholder="Enter command..."
                className="flex-1 bg-transparent text-green-400 text-sm outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handleExecuteCommand}
                disabled={isLoading || !command.trim()}
                className="btn btn-primary btn-sm"
              >
                Execute
              </button>
            </div>
            {executeCommand.data && (
              <div className="text-green-400 text-xs font-mono">
                <div className="text-yellow-400">Output:</div>
                <pre className="whitespace-pre-wrap">{executeCommand.data.output}</pre>
                {executeCommand.data.error && (
                  <>
                    <div className="text-red-400">Error:</div>
                    <pre className="whitespace-pre-wrap">{executeCommand.data.error}</pre>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
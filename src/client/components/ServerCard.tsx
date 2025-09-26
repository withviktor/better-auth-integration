import { Server, ServerStatus } from "@prisma/client";
import { api } from "@/utils/api";
import { useState } from "react";

interface ServerCardProps {
  server: Server & {
    instances: Array<{
      id: string;
      status: string;
      cpuUsage?: number;
      memoryUsage?: number;
      players?: number;
      uptime?: number;
    }>;
  };
  onUpdate: () => void;
}

export function ServerCard({ server, onUpdate }: ServerCardProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const startServer = api.server.start.useMutation();
  const stopServer = api.server.stop.useMutation();
  const restartServer = api.server.restart.useMutation();

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await startServer.mutateAsync({ serverId: server.id });
      onUpdate();
    } catch (error) {
      console.error("Failed to start server:", error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await stopServer.mutateAsync({ serverId: server.id });
      onUpdate();
    } catch (error) {
      console.error("Failed to stop server:", error);
    } finally {
      setIsStopping(false);
    }
  };

  const handleRestart = async () => {
    try {
      await restartServer.mutateAsync({ serverId: server.id });
      onUpdate();
    } catch (error) {
      console.error("Failed to restart server:", error);
    }
  };

  const getStatusColor = (status: ServerStatus) => {
    switch (status) {
      case ServerStatus.ONLINE:
        return "bg-green-100 text-green-800";
      case ServerStatus.OFFLINE:
        return "bg-gray-100 text-gray-800";
      case ServerStatus.STARTING:
        return "bg-yellow-100 text-yellow-800";
      case ServerStatus.STOPPING:
        return "bg-orange-100 text-orange-800";
      case ServerStatus.ERROR:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const latestInstance = server.instances[0];
  const uptime = latestInstance?.uptime
    ? `${Math.floor(latestInstance.uptime / 3600)}h ${Math.floor((latestInstance.uptime % 3600) / 60)}m`
    : "0m";

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {server.name}
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            {server.gameType.replace(/_/g, " ")} • Port {server.port}
          </p>
          {server.description && (
            <p className="text-sm text-gray-600 mb-3">{server.description}</p>
          )}
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
            server.status
          )}`}
        >
          {server.status}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Players:</span>
          <span className="font-medium">
            {latestInstance?.players || 0}/{server.maxPlayers}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">CPU:</span>
          <span className="font-medium">
            {latestInstance?.cpuUsage?.toFixed(1) || 0}%
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Memory:</span>
          <span className="font-medium">
            {latestInstance?.memoryUsage?.toFixed(1) || 0}%
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Uptime:</span>
          <span className="font-medium">{uptime}</span>
        </div>
      </div>

      <div className="flex space-x-2">
        {server.status === ServerStatus.ONLINE ? (
          <>
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {isStopping ? "Stopping..." : "Stop"}
            </button>
            <button
              onClick={handleRestart}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Restart
            </button>
          </>
        ) : (
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {isStarting ? "Starting..." : "Start"}
          </button>
        )}
      </div>
    </div>
  );
}
import { useState } from "react";
import { GameType } from "@prisma/client";
import { api } from "@/utils/api";

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateServerModal({ isOpen, onClose, onSuccess }: CreateServerModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    gameType: GameType.MINECRAFT_JAVA,
    version: "1.20.1",
    port: 25565,
    maxPlayers: 20,
    motd: "A Minecraft Server",
    cpuLimit: 2000,
    memoryLimit: 2048,
    diskLimit: 10240,
  });

  const createServer = api.server.create.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createServer.mutateAsync(formData);
      onSuccess();
      // Reset form
      setFormData({
        name: "",
        description: "",
        gameType: GameType.MINECRAFT_JAVA,
        version: "1.20.1",
        port: 25565,
        maxPlayers: 20,
        motd: "A Minecraft Server",
        cpuLimit: 2000,
        memoryLimit: 2048,
        diskLimit: 10240,
      });
    } catch (error) {
      console.error("Failed to create server:", error);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Create New Server</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Server Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="My Minecraft Server"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Game Type *
              </label>
              <select
                value={formData.gameType}
                onChange={(e) => handleInputChange("gameType", e.target.value as GameType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={GameType.MINECRAFT_JAVA}>Minecraft Java</option>
                <option value={GameType.MINECRAFT_BEDROCK}>Minecraft Bedrock</option>
                <option value={GameType.MINECRAFT_PAPER}>Minecraft Paper</option>
                <option value={GameType.MINECRAFT_SPIGOT}>Minecraft Spigot</option>
                <option value={GameType.MINECRAFT_BUNGEE}>Minecraft BungeeCord</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description for your server"
            />
          </div>

          {/* Server Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Port *
              </label>
              <input
                type="number"
                required
                min="1024"
                max="65535"
                value={formData.port}
                onChange={(e) => handleInputChange("port", parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Version *
              </label>
              <input
                type="text"
                required
                value={formData.version}
                onChange={(e) => handleInputChange("version", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1.20.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Players
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={formData.maxPlayers}
                onChange={(e) => handleInputChange("maxPlayers", parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MOTD (Message of the Day)
            </label>
            <input
              type="text"
              value={formData.motd}
              onChange={(e) => handleInputChange("motd", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="A Minecraft Server"
            />
          </div>

          {/* Resource Limits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CPU Limit (millicores)
              </label>
              <input
                type="number"
                min="100"
                max="8000"
                step="100"
                value={formData.cpuLimit}
                onChange={(e) => handleInputChange("cpuLimit", parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">1000 = 1 CPU core</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Memory Limit (MB)
              </label>
              <input
                type="number"
                min="512"
                max="16384"
                step="256"
                value={formData.memoryLimit}
                onChange={(e) => handleInputChange("memoryLimit", parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disk Limit (MB)
              </label>
              <input
                type="number"
                min="1024"
                max="102400"
                step="1024"
                value={formData.diskLimit}
                onChange={(e) => handleInputChange("diskLimit", parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createServer.isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md transition-colors"
            >
              {createServer.isLoading ? "Creating..." : "Create Server"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
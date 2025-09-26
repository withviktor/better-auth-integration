import { useState } from 'react';
import { trpc } from '@/client/utils/trpc';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface CreateServerModalProps {
  onClose: () => void;
}

export function CreateServerModal({ onClose }: CreateServerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serverTypeId: '',
    maxPlayers: 20,
    ram: 1024,
    cpu: 1.0,
    serverProperties: {},
    environmentVariables: {},
  });

  const utils = trpc.useUtils();

  const { data: serverTypes, isLoading: serverTypesLoading } = trpc.gameServers.getServerTypes.useQuery();

  const createServer = trpc.gameServers.createGameServer.useMutation({
    onSuccess: () => {
      utils.gameServers.getUserGameServers.invalidate();
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.serverTypeId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await createServer.mutateAsync(formData);
    } catch (error) {
      console.error('Failed to create server:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const selectedServerType = serverTypes?.find(st => st.id === formData.serverTypeId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Game Server</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Server Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="input"
                placeholder="My Awesome Server"
                required
              />
            </div>

            <div>
              <label className="label">Server Type *</label>
              <select
                value={formData.serverTypeId}
                onChange={(e) => handleChange('serverTypeId', e.target.value)}
                className="input"
                required
                disabled={serverTypesLoading}
              >
                <option value="">Select a server type</option>
                {serverTypes?.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="input"
              rows={3}
              placeholder="Optional description for your server"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="label">Max Players</label>
              <input
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => handleChange('maxPlayers', parseInt(e.target.value))}
                className="input"
                min="1"
                max="1000"
              />
            </div>

            <div>
              <label className="label">RAM (MB)</label>
              <select
                value={formData.ram}
                onChange={(e) => handleChange('ram', parseInt(e.target.value))}
                className="input"
              >
                <option value={512}>512 MB</option>
                <option value={1024}>1 GB</option>
                <option value={2048}>2 GB</option>
                <option value={4096}>4 GB</option>
                <option value={8192}>8 GB</option>
                <option value={16384}>16 GB</option>
                <option value={32768}>32 GB</option>
              </select>
            </div>

            <div>
              <label className="label">CPU Cores</label>
              <select
                value={formData.cpu}
                onChange={(e) => handleChange('cpu', parseFloat(e.target.value))}
                className="input"
              >
                <option value={0.5}>0.5 cores</option>
                <option value={1.0}>1 core</option>
                <option value={2.0}>2 cores</option>
                <option value={4.0}>4 cores</option>
                <option value={8.0}>8 cores</option>
                <option value={16.0}>16 cores</option>
              </select>
            </div>
          </div>

          {selectedServerType && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Server Type Information</h3>
              <div className="text-sm text-blue-700">
                <p><strong>Image:</strong> {selectedServerType.dockerImage}</p>
                <p><strong>Default Port:</strong> {selectedServerType.defaultPort}</p>
                <p><strong>Description:</strong> {selectedServerType.description}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createServer.isPending}
              className="btn btn-primary"
            >
              {createServer.isPending ? 'Creating...' : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
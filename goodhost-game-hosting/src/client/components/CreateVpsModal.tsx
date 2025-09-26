import { useState } from 'react';
import { trpc } from '@/client/utils/trpc';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface CreateVpsModalProps {
  onClose: () => void;
}

export function CreateVpsModal({ onClose }: CreateVpsModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ram: 1024,
    cpu: 1.0,
    diskSpace: 10240,
    operatingSystem: 'ubuntu:22.04',
  });

  const utils = trpc.useUtils();

  const createVps = trpc.vps.createVpsInstance.useMutation({
    onSuccess: () => {
      utils.vps.getUserVpsInstances.invalidate();
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await createVps.mutateAsync(formData);
    } catch (error) {
      console.error('Failed to create VPS:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const operatingSystems = [
    { value: 'ubuntu:22.04', label: 'Ubuntu 22.04 LTS' },
    { value: 'ubuntu:20.04', label: 'Ubuntu 20.04 LTS' },
    { value: 'debian:11', label: 'Debian 11' },
    { value: 'centos:8', label: 'CentOS 8' },
    { value: 'alpine:3.18', label: 'Alpine Linux 3.18' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create VPS Instance</h2>
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
              <label className="label">Instance Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="input"
                placeholder="My VPS Instance"
                required
              />
            </div>

            <div>
              <label className="label">Operating System *</label>
              <select
                value={formData.operatingSystem}
                onChange={(e) => handleChange('operatingSystem', e.target.value)}
                className="input"
                required
              >
                {operatingSystems.map((os) => (
                  <option key={os.value} value={os.value}>
                    {os.label}
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
              placeholder="Optional description for your VPS instance"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <div>
              <label className="label">Disk Space (MB)</label>
              <select
                value={formData.diskSpace}
                onChange={(e) => handleChange('diskSpace', parseInt(e.target.value))}
                className="input"
              >
                <option value={10240}>10 GB</option>
                <option value={20480}>20 GB</option>
                <option value={51200}>50 GB</option>
                <option value={102400}>100 GB</option>
                <option value={204800}>200 GB</option>
                <option value={512000}>500 GB</option>
                <option value={1048576}>1 TB</option>
              </select>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-900 mb-2">Important Information</h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>• Your VPS will be accessible via SSH on a randomly assigned port</p>
              <p>• A root password will be generated and displayed after creation</p>
              <p>• The VPS will be created with Docker and basic tools pre-installed</p>
              <p>• You can execute commands through the web interface or SSH</p>
            </div>
          </div>

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
              disabled={createVps.isPending}
              className="btn btn-primary"
            >
              {createVps.isPending ? 'Creating...' : 'Create VPS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
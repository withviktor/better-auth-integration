import { useState } from 'react';
import Head from 'next/head';
import { trpc } from '@/client/utils/trpc';
import { GameServerCard } from '@/client/components/GameServerCard';
import { VpsInstanceCard } from '@/client/components/VpsInstanceCard';
import { CreateServerModal } from '@/client/components/CreateServerModal';
import { CreateVpsModal } from '@/client/components/CreateVpsModal';
import { 
  PlusIcon, 
  ServerIcon, 
  ComputerDesktopIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

export default function Dashboard() {
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showCreateVps, setShowCreateVps] = useState(false);

  const { data: gameServers, isLoading: gameServersLoading } = trpc.gameServers.getUserGameServers.useQuery();
  const { data: vpsInstances, isLoading: vpsInstancesLoading } = trpc.vps.getUserVpsInstances.useQuery();

  const stats = [
    {
      name: 'Game Servers',
      value: gameServers?.length || 0,
      icon: ServerIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'VPS Instances',
      value: vpsInstances?.length || 0,
      icon: ComputerDesktopIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Total Resources',
      value: '2.5 GB RAM',
      icon: ChartBarIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Active Services',
      value: (gameServers?.filter(s => s.status === 'running').length || 0) + 
             (vpsInstances?.filter(v => v.status === 'running').length || 0),
      icon: Cog6ToothIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <>
      <Head>
        <title>GoodHost Dashboard</title>
        <meta name="description" content="Modern game server hosting platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">GoodHost</h1>
                <span className="ml-2 text-sm text-gray-500">Game Hosting Platform</span>
              </div>
              <div className="flex items-center space-x-4">
                <button className="btn btn-primary btn-md">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Server
                </button>
                <button className="btn btn-secondary btn-md">
                  <Cog6ToothIcon className="h-4 w-4 mr-2" />
                  Settings
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat) => (
              <div key={stat.name} className="card">
                <div className="card-body">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                      <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="card mb-8">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setShowCreateServer(true)}
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ServerIcon className="h-8 w-8 text-blue-600 mr-4" />
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">Create Game Server</h3>
                    <p className="text-sm text-gray-500">Deploy Minecraft, CS2, Rust, and more</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowCreateVps(true)}
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ComputerDesktopIcon className="h-8 w-8 text-green-600 mr-4" />
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">Create VPS Instance</h3>
                    <p className="text-sm text-gray-500">Deploy Ubuntu, CentOS, or custom OS</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Game Servers Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Game Servers</h2>
              <button
                onClick={() => setShowCreateServer(true)}
                className="btn btn-primary btn-sm"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                New Server
              </button>
            </div>
            
            {gameServersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="card-body">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                      <div className="h-8 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : gameServers && gameServers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gameServers.map((server) => (
                  <GameServerCard key={server.id} server={server as any} />
                ))}
              </div>
            ) : (
              <div className="card">
                <div className="card-body text-center py-12">
                  <ServerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No game servers yet</h3>
                  <p className="text-gray-500 mb-4">Create your first game server to get started</p>
                  <button
                    onClick={() => setShowCreateServer(true)}
                    className="btn btn-primary"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create Game Server
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* VPS Instances Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">VPS Instances</h2>
              <button
                onClick={() => setShowCreateVps(true)}
                className="btn btn-primary btn-sm"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                New VPS
              </button>
            </div>
            
            {vpsInstancesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="card-body">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                      <div className="h-8 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : vpsInstances && vpsInstances.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vpsInstances.map((instance) => (
                  <VpsInstanceCard key={instance.id} instance={instance as any} />
                ))}
              </div>
            ) : (
              <div className="card">
                <div className="card-body text-center py-12">
                  <ComputerDesktopIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No VPS instances yet</h3>
                  <p className="text-gray-500 mb-4">Create your first VPS instance to get started</p>
                  <button
                    onClick={() => setShowCreateVps(true)}
                    className="btn btn-primary"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create VPS Instance
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Modals */}
        {showCreateServer && (
          <CreateServerModal onClose={() => setShowCreateServer(false)} />
        )}
        {showCreateVps && (
          <CreateVpsModal onClose={() => setShowCreateVps(false)} />
        )}
      </div>
    </>
  );
}
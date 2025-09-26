import 'dotenv/config';
import { Worker } from 'bullmq';
import Docker, { Container } from 'dockerode';
import pino from 'pino';
import { JOBS, type JobPayload } from '@goodhost/shared';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info' });
const docker = new Docker();

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

async function ensureImage(image: string) {
  const images = await docker.listImages({ filters: { reference: [image] } as any });
  if (images.length === 0) {
    logger.info({ image }, 'Pulling image');
    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (pullError: unknown, stream: NodeJS.ReadableStream | undefined) => {
        if (pullError) return reject(pullError);
        if (!stream) return resolve();
        docker.modem.followProgress(stream, (progressError: unknown) => (progressError ? reject(progressError) : resolve()));
      });
    });
  }
}

async function startMinecraftContainer(serverId: string) {
  const image = 'itzg/minecraft-server:latest';
  await ensureImage(image);
  const container = await docker.createContainer({
    Image: image,
    name: `gh-${serverId}`,
    Env: [
      'EULA=TRUE',
      'TZ=UTC',
      'MEMORY=1G'
    ],
    HostConfig: {
      PortBindings: { '25565/tcp': [{ HostPort: '' }] },
      RestartPolicy: { Name: 'unless-stopped' }
    },
    ExposedPorts: { '25565/tcp': {} }
  });
  await container.start();
  const details = await container.inspect();
  const mapped = details.NetworkSettings.Ports?.['25565/tcp']?.[0]?.HostPort;
  logger.info({ serverId, hostPort: mapped }, 'Started Minecraft container');
}

async function stopContainerByName(name: string) {
  try {
    const container: Container = docker.getContainer(name);
    await container.stop({ t: 10 });
    await container.remove({ force: true });
    logger.info({ name }, 'Stopped and removed container');
  } catch (err) {
    logger.warn({ err, name }, 'Error stopping container');
  }
}

function runWorker() {
  const worker = new Worker<JobPayload>(
    'server-jobs',
    async (job) => {
      if (job.name === JOBS.START_SERVER) {
        await startMinecraftContainer(job.data.serverId);
      } else if (job.name === JOBS.STOP_SERVER) {
        await stopContainerByName(`gh-${job.data.serverId}`);
      }
    },
    { connection: { url: redisUrl } }
  );

  worker.on('completed', (job) => logger.info({ id: job.id, name: job.name }, 'Job completed'));
  worker.on('failed', (job, err) => logger.error({ id: job?.id, name: job?.name, err }, 'Job failed'));
}

runWorker();

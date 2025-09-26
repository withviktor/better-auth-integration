export type JobPayload = {
  serverId: string;
};

export const JOBS = {
  START_SERVER: 'start-server',
  STOP_SERVER: 'stop-server'
} as const;

import { HashtreeWorkerClient } from '@hashtree/worker/client';
import type { BlossomServerConfig } from '@hashtree/worker/protocol';
import HashtreeWorker from '../workers/hashtree.worker.ts?worker';

const DEFAULT_BLOSSOM_SERVERS: BlossomServerConfig[] = [
  { url: 'https://upload.iris.to', read: false, write: true },
  { url: 'https://cdn.iris.to', read: true, write: false },
  { url: 'https://hashtree.iris.to', read: true, write: false },
];

let client: HashtreeWorkerClient | null = null;
let initPromise: Promise<HashtreeWorkerClient> | null = null;

export async function getWorkerClient(): Promise<HashtreeWorkerClient> {
  if (client) return client;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const created = new HashtreeWorkerClient(HashtreeWorker, {
      storeName: 'iris-audio-worker',
      blossomServers: DEFAULT_BLOSSOM_SERVERS,
    });
    await created.init();
    client = created;
    return created;
  })();

  return initPromise;
}

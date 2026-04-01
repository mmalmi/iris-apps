import { getWorkerClient } from './workerClient';

let setupPromise: Promise<boolean> | null = null;
let streamingReady = false;

async function waitForController(timeoutMs = 5_000): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) return null;
  if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
  await navigator.serviceWorker.ready.catch(() => undefined);
  if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;

  return await new Promise<ServiceWorker | null>((resolve) => {
    const timeoutId = setTimeout(() => resolve(navigator.serviceWorker.controller ?? null), timeoutMs);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      clearTimeout(timeoutId);
      resolve(navigator.serviceWorker.controller ?? null);
    }, { once: true });
  });
}

async function setupStreaming(): Promise<boolean> {
  const controller = await waitForController();
  if (!controller) return false;

  const workerClient = await getWorkerClient();
  await workerClient.init();

  const channel = new MessageChannel();
  const requestId = `media-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ackPromise = new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve(false);
    }, 5_000);
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string; requestId?: string };
      if (data?.type === 'WORKER_PORT_READY' && data.requestId === requestId) {
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener('message', onMessage);
        resolve(true);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
  });

  controller.postMessage({ type: 'REGISTER_WORKER_PORT', port: channel.port1, requestId }, [channel.port1]);
  await workerClient.registerMediaPort(channel.port2);
  const acked = await ackPromise;
  streamingReady = acked;
  return acked;
}

export async function ensureHashtreeStreamingReady(): Promise<boolean> {
  if (streamingReady) return true;
  if (!setupPromise) {
    setupPromise = setupStreaming().finally(() => {
      if (!streamingReady) setupPromise = null;
    });
  }
  return await setupPromise;
}

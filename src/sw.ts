/// <reference lib="webworker" />
import { getRawHtreePath, parseImmutableHtreePath } from '@hashtree/worker/htree-path';
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

type FileRequest = {
  type: 'hashtree-file';
  requestId: string;
  nhash: string;
  path: string;
  start: number;
  end?: number;
  mimeType: string;
};

const PORT_TIMEOUT_MS = 20_000;
const PORT_WAIT_TIMEOUT_MS = 8_000;
const PORT_WAIT_INTERVAL_MS = 50;

let defaultWorkerPort: MessagePort | null = null;
const pendingRequests = new Map<string, {
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
}>();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function guessMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    oga: 'audio/ogg',
    json: 'application/json',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return mimeTypes[ext] ?? 'application/octet-stream';
}

function waitForWorkerPort(timeoutMs = PORT_WAIT_TIMEOUT_MS): Promise<MessagePort | null> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const poll = (): void => {
      if (defaultWorkerPort) {
        resolve(defaultWorkerPort);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(null);
        return;
      }
      setTimeout(poll, PORT_WAIT_INTERVAL_MS);
    };
    poll();
  });
}

function buildResponseHeaders(path: string, totalSize: number, status: number, start: number, end: number): Headers {
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Content-Type': guessMimeType(path),
    'Content-Length': String(Math.max(0, end - start + 1)),
  });
  if (status === 206) {
    headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
  }
  return headers;
}

function normalizeChunkData(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data as ArrayLike<number>);
}

function handleWorkerMessage(event: MessageEvent): void {
  const message = event.data as
    | { type: 'headers'; requestId: string; totalSize: number; status?: number; headers?: Record<string, string> }
    | { type: 'chunk'; requestId: string; data: Uint8Array }
    | { type: 'done'; requestId: string }
    | { type: 'error'; requestId: string; message?: string; status?: number };
  const pending = pendingRequests.get(message.requestId);
  if (!pending) return;

  switch (message.type) {
    case 'headers': {
      const transform = new TransformStream<Uint8Array>();
      const writer = transform.writable.getWriter();
      const headers = new Headers(message.headers ?? {});
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
      (pending as typeof pending & { writer?: WritableStreamDefaultWriter<Uint8Array> }).writer = writer;
      pending.resolve(new Response(transform.readable, { status: message.status ?? 200, headers }));
      return;
    }
    case 'chunk': {
      const writer = (pending as typeof pending & { writer?: WritableStreamDefaultWriter<Uint8Array> }).writer;
      void writer?.write(normalizeChunkData(message.data));
      return;
    }
    case 'done': {
      const writer = (pending as typeof pending & { writer?: WritableStreamDefaultWriter<Uint8Array> }).writer;
      void writer?.close();
      pendingRequests.delete(message.requestId);
      return;
    }
    case 'error': {
      pending.resolve(new Response(message.message ?? 'Worker error', { status: message.status ?? 500 }));
      pendingRequests.delete(message.requestId);
    }
  }
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type !== 'REGISTER_WORKER_PORT') return;
  const port = event.data?.port ?? event.ports?.[0];
  if (!port) return;
  defaultWorkerPort = port;
  port.start?.();
  port.onmessage = handleWorkerMessage;
  const requestId = event.data?.requestId;
  if (requestId && event.source && 'postMessage' in event.source) {
    event.source.postMessage({ type: 'WORKER_PORT_READY', requestId });
  }
});

async function serveImmutableHtreeRequest(request: FileRequest): Promise<Response> {
  const port = defaultWorkerPort ?? await waitForWorkerPort();
  if (!port) {
    return new Response('Hashtree worker port unavailable', { status: 503 });
  }

  return new Promise<Response>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(request.requestId);
      reject(new Error('Timed out waiting for hashtree worker'));
    }, PORT_TIMEOUT_MS);

    pendingRequests.set(request.requestId, {
      resolve: (response) => {
        clearTimeout(timeout);
        resolve(response);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });

    port.postMessage(request);
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const rawPath = getRawHtreePath(url);
  const parsed = parseImmutableHtreePath(rawPath);
  if (!parsed) return;

  event.respondWith((async () => {
    const rangeHeader = event.request.headers.get('range');
    const requestId = `htree-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const rangeMatch = rangeHeader ? /bytes=(\d+)-(\d+)?/.exec(rangeHeader) : null;
    const start = rangeMatch ? Number(rangeMatch[1]) : 0;
    const end = rangeMatch && rangeMatch[2] ? Number(rangeMatch[2]) : undefined;

    return await serveImmutableHtreeRequest({
      type: 'hashtree-file',
      requestId,
      nhash: parsed.nhash,
      path: parsed.filePath,
      start,
      end,
      mimeType: guessMimeType(parsed.filePath),
    });
  })());
});

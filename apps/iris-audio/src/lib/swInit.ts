import { registerSW } from 'virtual:pwa-register';
import { ensureHashtreeStreamingReady } from './workerStreaming';

export async function initServiceWorker(): Promise<void> {
  const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const pageProtocol = typeof window !== 'undefined' ? window.location.protocol : '';

  if (!hasServiceWorker) return;
  if (pageProtocol === 'htree:') return;

  try {
    registerSW({ immediate: true });

    if (!navigator.serviceWorker.controller) {
      await navigator.serviceWorker.ready;

      if (!navigator.serviceWorker.controller) {
        const gotController = await Promise.race([
          new Promise<boolean>((resolve) => {
            navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once: true });
          }),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 150)),
        ]);

        if (!gotController && !navigator.serviceWorker.controller) {
          window.location.reload();
          return new Promise(() => {});
        }
      }
    }

    await ensureHashtreeStreamingReady();
  } catch (error) {
    console.error('[SW] Registration error:', error);
  }
}

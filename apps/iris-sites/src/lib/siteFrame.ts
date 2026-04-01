import type { HostedSite } from './siteConfig';
import type { TreeRootInfo } from './workerClient';

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function buildSiteFrameSrc(
  currentSite: HostedSite | null,
  runtimeReady: boolean,
  clientKey: string,
  currentTreeRoot: TreeRootInfo | null,
): string {
  if (!currentSite || !runtimeReady) return '';

  // Mutable sites need an initial tree root before the worker can resolve the
  // current entrypoint reliably. Rendering the iframe earlier produces a
  // permanent "File data not found" response in portable smoke and CI.
  if (currentSite.kind === 'mutable' && !currentTreeRoot) {
    return '';
  }

  const encodedPath = encodePath(currentSite.entryPath || 'index.html');
  if (currentSite.kind === 'immutable') {
    return `/htree/${currentSite.nhash}/${encodedPath}?htree_c=${encodeURIComponent(clientKey)}`;
  }

  const encodedTreeName = encodeURIComponent(currentSite.treeName);
  return `/htree/${currentSite.npub}/${encodedTreeName}/${encodedPath}?htree_c=${encodeURIComponent(clientKey)}`;
}

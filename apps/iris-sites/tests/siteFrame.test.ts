import { describe, expect, it } from 'vitest';
import { buildSiteFrameSrc } from '../src/lib/siteFrame';

describe('site frame src', () => {
  it('waits for a mutable tree root before rendering the iframe src', () => {
    const mutableSite = {
      kind: 'mutable' as const,
      siteKey: 'pilot',
      title: 'enshittifier',
      npub: 'npub1example',
      treeName: 'enshittifier',
      entryPath: 'index.html',
    };

    expect(buildSiteFrameSrc(mutableSite, true, 'client-key', null)).toBe('');
    expect(buildSiteFrameSrc(mutableSite, true, 'client-key', {
      hash: new Uint8Array([1, 2, 3]),
      updatedAt: Date.now(),
      visibility: 'public',
    })).toBe('/htree/npub1example/enshittifier/index.html?htree_c=client-key');
  });

  it('renders immutable iframe src as soon as runtime is ready', () => {
    const immutableSite = {
      kind: 'immutable' as const,
      siteKey: 'pilot',
      title: 'Pinned',
      nhash: 'nhash1example',
      entryPath: 'docs/hello world.html',
    };

    expect(buildSiteFrameSrc(immutableSite, true, 'client-key', null)).toBe(
      '/htree/nhash1example/docs/hello%20world.html?htree_c=client-key',
    );
  });
});

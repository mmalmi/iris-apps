import { describe, expect, it } from 'vitest';
import { getFilesBase } from '../portableViteConfig';

describe('vite base path', () => {
  it('uses /iris-apps/ for GitHub Pages builds', () => {
    expect(getFilesBase({ GITHUB_PAGES: 'true' })).toBe('/iris-apps/');
  });

  it('uses a relative base outside GitHub Pages builds', () => {
    expect(getFilesBase({})).toBe('./');
  });
});

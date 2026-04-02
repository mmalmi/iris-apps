import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  resolveHashtreeCiDir,
  resolveHashtreeRepoRoot,
  resolveHashtreeRustDir,
  resolveHtreeCommand,
} from '../scripts/hashtreePaths.mjs';

const originalEnv = {
  HASHTREE_REPO_ROOT: process.env.HASHTREE_REPO_ROOT,
  HASHTREE_RUST_DIR: process.env.HASHTREE_RUST_DIR,
  HASHTREE_CI_DIR: process.env.HASHTREE_CI_DIR,
  HTREE_BIN: process.env.HTREE_BIN,
};

function resetEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  resetEnv();
});

describe('hashtree path resolution', () => {
  it('does not auto-detect sibling hashtree checkouts', () => {
    delete process.env.HASHTREE_REPO_ROOT;
    delete process.env.HASHTREE_RUST_DIR;
    delete process.env.HASHTREE_CI_DIR;
    delete process.env.HTREE_BIN;

    expect(resolveHashtreeRepoRoot()).toBeNull();
    expect(resolveHashtreeRustDir()).toBeNull();
    expect(resolveHashtreeCiDir()).toBeNull();
    expect(resolveHtreeCommand('add', '.')).toEqual(['htree', 'add', '.']);
  });

  it('still honors explicit rust workspace overrides', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-files-hashtree-'));
    const rustDir = path.join(tempRoot, 'rust');

    fs.mkdirSync(rustDir, { recursive: true });
    fs.writeFileSync(path.join(rustDir, 'Cargo.toml'), '[package]\nname = "hashtree-cli"\nversion = "0.0.0"\n');
    process.env.HASHTREE_RUST_DIR = rustDir;

    expect(resolveHashtreeRustDir()).toBe(rustDir);
    expect(resolveHtreeCommand('add', '.')).toEqual([
      'cargo',
      'run',
      '--manifest-path',
      path.join(rustDir, 'Cargo.toml'),
      '-p',
      'hashtree-cli',
      '--bin',
      'htree',
      '--',
      'add',
      '.',
    ]);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distIndexPath = resolve(import.meta.dirname, '..', 'dist', 'index.html');

test('portable iris-audio build uses relative asset URLs', () => {
  const html = readFileSync(distIndexPath, 'utf8');

  assert(!html.includes('src="/assets/'), 'expected script asset path to be relative');
  assert(!html.includes('href="/assets/'), 'expected stylesheet asset path to be relative');
  assert(!html.includes('href="/manifest.webmanifest"'), 'expected manifest path to be relative');
  assert(!html.includes('href="/favicon.svg"'), 'expected favicon path to be relative');
});

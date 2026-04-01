import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  GIT_REMOTE_HTREE_INSTALL_COMMAND,
  GIT_REMOTE_HTREE_INSTALL_DOCS_URL,
} from '../src/components/Git/codeDropdownCopy.js';
import { repoRoot, resolveReferenceFile } from './hashtreePaths.mjs';

function resolveHashtreeCcReference(...segments) {
  const candidates = [
    process.env.HASHTREE_CC_REPO_ROOT,
    path.resolve(repoRoot, '..', 'hashtree-cc'),
    path.join(repoRoot, 'hashtree-cc'),
    resolveReferenceFile(...segments),
  ].filter(Boolean);

  for (const candidateRoot of candidates) {
    const candidatePath =
      candidateRoot === resolveReferenceFile(...segments)
        ? candidateRoot
        : path.join(candidateRoot, ...segments);
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return path.resolve(repoRoot, '..', 'hashtree-cc', ...segments);
}

const checks = [
  {
    label: 'root README install section',
    path: resolveReferenceFile('README.md'),
    mustInclude: [
      GIT_REMOTE_HTREE_INSTALL_COMMAND,
    ],
  },
  {
    label: 'git-remote-htree README install section',
    path: resolveReferenceFile('rust', 'crates', 'git-remote-htree', 'README.md'),
    mustInclude: [
      GIT_REMOTE_HTREE_INSTALL_COMMAND,
    ],
  },
  {
    label: 'hashtree.cc developers install section',
    path: resolveHashtreeCcReference('apps', 'hashtree-cc', 'src', 'components', 'Developers.svelte'),
    mustInclude: [
      GIT_REMOTE_HTREE_INSTALL_COMMAND,
    ],
  },
  {
    label: 'Code dropdown docs link',
    path: new URL('../src/components/Git/codeDropdownCopy.js', import.meta.url),
    mustInclude: [
      GIT_REMOTE_HTREE_INSTALL_DOCS_URL,
    ],
  },
];

let failed = false;

for (const check of checks) {
  const content = readFileSync(check.path, 'utf8');
  for (const needle of check.mustInclude) {
    if (!content.includes(needle)) {
      console.error(`[git-install-copy] Missing ${JSON.stringify(needle)} in ${check.label}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('[git-install-copy] Install copy is aligned across UI and README docs.');

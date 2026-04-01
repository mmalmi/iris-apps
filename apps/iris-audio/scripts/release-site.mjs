import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolveHtreeCommand } from './hashtreePaths.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');
const defaultWorkerCompatibilityDate = '2026-04-01';
const wranglerVersion = '4.78.0';

export const releaseProfile = {
  appName: 'Iris Audio',
  distDir: 'dist',
  treeName: 'audio',
  defaultWorkerName: 'iris-audio',
  defaultDomains: ['audio.iris.to'],
  buildCommand: ['pnpm', 'run', 'build'],
  testCommands: [
    ['node', '--test', 'tests/portable-build.test.mjs'],
    ['pnpm', 'run', 'test:e2e'],
  ],
};

function wranglerWorkerAssetsCommand(...args) {
  return ['npx', `wrangler@${wranglerVersion}`, 'deploy', ...args];
}

export function parseArgs(argv, env = process.env) {
  const args = [...argv].filter((arg, index) => !(arg === '--' && index === 0));
  let workerName;
  let treeName;
  let dryRun = false;
  let skipCloudflare = false;
  const routes = [];
  const domains = [];
  let workerCompatibilityDate;

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '-h' || arg === '--help') return { help: true };
    if (arg === '--') continue;
    if (arg === '--worker-name') {
      workerName = args.shift();
      continue;
    }
    if (arg === '--tree') {
      treeName = args.shift();
      continue;
    }
    if (arg === '--route') {
      routes.push(args.shift());
      continue;
    }
    if (arg === '--domain') {
      domains.push(args.shift());
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--compatibility-date') {
      workerCompatibilityDate = args.shift();
      continue;
    }
    if (arg === '--skip-cloudflare') {
      skipCloudflare = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    dryRun,
    skipCloudflare,
    treeName: treeName ?? releaseProfile.treeName,
    workerName: workerName ?? env.CF_WORKER_NAME_AUDIO ?? releaseProfile.defaultWorkerName,
    routes,
    domains: domains.length > 0 ? domains : releaseProfile.defaultDomains,
    workerCompatibilityDate:
      workerCompatibilityDate ?? env.CF_WORKER_COMPATIBILITY_DATE ?? defaultWorkerCompatibilityDate,
  };
}

export function createReleasePlan(options) {
  const distDir = path.join(appDir, releaseProfile.distDir);
  const steps = [
    {
      id: 'build',
      label: `Build ${releaseProfile.appName}`,
      command: releaseProfile.buildCommand,
      cwd: appDir,
    },
    ...releaseProfile.testCommands.map((command, index) => ({
      id: `test-${index + 1}`,
      label: `Test ${releaseProfile.appName} (${index + 1}/${releaseProfile.testCommands.length})`,
      command,
      cwd: appDir,
    })),
    {
      id: 'publish',
      label: `Publish ${releaseProfile.appName} to hashtree`,
      command: resolveHtreeCommand('add', '.', '--publish', options.treeName),
      cwd: distDir,
    },
  ];

  if (!options.skipCloudflare) {
    const deployCommand = wranglerWorkerAssetsCommand(
      '--assets',
      releaseProfile.distDir,
      '--name',
      options.workerName,
      '--compatibility-date',
      options.workerCompatibilityDate,
      '--keep-vars',
    );
    for (const route of options.routes ?? []) deployCommand.push('--route', route);
    for (const domain of options.domains ?? []) deployCommand.push('--domain', domain);
    steps.push({
      id: 'deploy',
      label: `Deploy ${releaseProfile.appName} to Cloudflare Worker`,
      command: deployCommand,
      cwd: appDir,
    });
  }

  return { profile: releaseProfile, distDir, steps };
}

function defaultRunner(step) {
  const [command, ...args] = step.command;
  console.log(`\n==> ${step.label}`);
  console.log(`$ ${[command, ...args].join(' ')}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: step.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        const signalMessage = `Process exited with signal ${signal}\n`;
        stderr += signalMessage;
        process.stderr.write(signalMessage);
      }
      resolve({ status: code ?? 1, stdout, stderr });
    });
  });
}

function ensureDistExists(distDir) {
  if (!existsSync(distDir)) {
    throw new Error(`Build output directory not found: ${distDir}`);
  }
}

export function parsePublishOutput(output) {
  const nhashMatch = output.match(/nhash1[ac-hj-np-z02-9]+/i);
  if (!nhashMatch) {
    throw new Error('Publish succeeded but no nhash was found in htree output');
  }
  return nhashMatch[0];
}

export async function runRelease(options, runner = defaultRunner) {
  const plan = createReleasePlan(options);
  let publishedNhash = null;

  for (const step of plan.steps) {
    if (step.id === 'publish') ensureDistExists(plan.distDir);
    if (options.dryRun) {
      console.log(`\n==> ${step.label}`);
      console.log(`$ ${step.command.join(' ')}`);
      continue;
    }

    const result = await runner(step);
    if (result.status !== 0) {
      throw new Error(`${step.label} failed with exit code ${result.status}`);
    }
    if (step.id === 'publish') {
      publishedNhash = parsePublishOutput(`${result.stdout}\n${result.stderr}`);
    }
  }

  if (publishedNhash) {
    console.log(`\nHashtree URL: htree://${publishedNhash}/index.html`);
  }
  if (!options.skipCloudflare) {
    console.log(`Worker URL target: https://${(options.domains?.[0]) || 'audio.iris.to'}/`);
  }
}

function printHelp() {
  console.log(`Usage: node ./scripts/release-site.mjs [options]

Options:
  --worker-name <name>          Cloudflare Worker name (default: ${releaseProfile.defaultWorkerName})
  --tree <name>                 hashtree publish name (default: ${releaseProfile.treeName})
  --route <pattern>             Worker route, for example audio.iris.to/*
  --domain <hostname>           Worker custom domain, for example audio.iris.to
  --compatibility-date <date>   Wrangler compatibility date (default: ${defaultWorkerCompatibilityDate})
  --skip-cloudflare             Only build/test/publish to hashtree
  --dry-run                     Print commands without running them
  -h, --help                    Show this message
`);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

runRelease(options).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

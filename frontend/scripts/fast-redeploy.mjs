import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(projectRoot, '..');
const cliArguments = process.argv.slice(2);
const argumentSet = new Set(cliArguments);

const isWatchMode = argumentSet.has('--watch');
const isProduction = argumentSet.has('--prod');
const isBuildOnly = argumentSet.has('--build-only');
const shouldSkipPull = argumentSet.has('--skip-pull');
const debounceMs = readNumberFlag('--debounce', 1200);
const environment = isProduction ? 'production' : 'preview';
const watchTargets = [
  'src',
  'angular.json',
  'package.json',
  'vercel.json',
  'scripts/generate-runtime-config.mjs',
  'scripts/vercel-build.mjs',
  'scripts/prepare-vercel-output.mjs',
  'scripts/fast-redeploy.mjs',
];

let hasPulled = false;
let runInFlight = false;
let rerunRequested = false;
let scheduledRun = null;
let scheduledReason = 'manual';
let activeWatchers = [];

if (argumentSet.has('--help')) {
  printHelp();
  process.exit(0);
}

function readNumberFlag(flagName, fallbackValue) {
  const flagWithEquals = cliArguments.find(argument => argument.startsWith(`${flagName}=`));
  const rawValue =
    flagWithEquals?.slice(flagName.length + 1) ??
    cliArguments[cliArguments.indexOf(flagName) + 1];

  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function printHelp() {
  console.log(`Usage: node scripts/fast-redeploy.mjs [options]

Options:
  --watch             Watch frontend files and redeploy after changes.
  --prod              Deploy to production instead of preview.
  --build-only        Build locally and refresh .vercel/output without uploading.
  --skip-pull         Skip "vercel pull" and reuse the current linked project settings.
  --debounce <ms>     Debounce window for watch mode (default: 1200).
  --help              Show this help message.
`);
}

function npxCommand() {
  return 'npx';
}

function windowsShell() {
  return process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
}

function formatCommand(command, args) {
  return [command, ...args]
    .map(value => (/[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value))
    .join(' ');
}

function log(message) {
  console.log(`[fast-redeploy] ${message}`);
}

function runCommand(command, args, label, extraEnv = {}, workingDirectory = projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const startedAt = Date.now();
    log(`${label}...`);
    const commandEnvironment = { ...process.env, ...extraEnv };

    const child = process.platform === 'win32'
      ? spawn(windowsShell(), ['/d', '/s', '/c', formatCommand(command, args)], {
          cwd: workingDirectory,
          stdio: 'inherit',
          env: commandEnvironment,
        })
      : spawn(command, args, {
          cwd: workingDirectory,
          stdio: 'inherit',
          env: commandEnvironment,
        });

    child.on('error', rejectPromise);
    child.on('exit', code => {
      if (code === 0) {
        log(`${label} finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${label} failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}

function runVercel(argumentsList, label) {
  return runCommand(npxCommand(), ['vercel', ...argumentsList], label, {}, workspaceRoot);
}

function runNodeScript(scriptRelativePath, label, extraEnv = {}) {
  return runCommand('node', [resolve(projectRoot, scriptRelativePath)], label, extraEnv);
}

function normalizeLocalProjectSettings() {
  const projectSettingsPath = resolve(workspaceRoot, '.vercel', 'project.json');

  if (!existsSync(projectSettingsPath)) {
    return;
  }

  const projectSettings = JSON.parse(readFileSync(projectSettingsPath, 'utf8'));
  const rootDirectory = projectSettings.settings?.rootDirectory;

  if (!rootDirectory) {
    return;
  }

  const nestedRootPath = resolve(workspaceRoot, rootDirectory);
  if (existsSync(nestedRootPath)) {
    return;
  }

  delete projectSettings.settings.rootDirectory;
  writeFileSync(projectSettingsPath, `${JSON.stringify(projectSettings, null, 2)}\n`, 'utf8');
  log(`Patched local Vercel settings to avoid nested rootDirectory="${rootDirectory}".`);
}

async function ensureProjectSettings() {
  if (shouldSkipPull || hasPulled) {
    return;
  }

  await runVercel(
    ['pull', '--yes', '--environment', environment],
    `Pulling ${environment} project settings`
  );
  normalizeLocalProjectSettings();
  hasPulled = true;
}

async function performRun(reason) {
  if (runInFlight) {
    rerunRequested = true;
    scheduledReason = reason;
    return;
  }

  runInFlight = true;
  rerunRequested = false;
  log(`Trigger: ${reason}`);

  try {
    await ensureProjectSettings();
    normalizeLocalProjectSettings();
    await runNodeScript('scripts/vercel-build.mjs', 'Building Angular locally', {
      VERCEL_ENV: environment,
    });
    await runNodeScript(
      'scripts/prepare-vercel-output.mjs',
      'Preparing Vercel Build Output API bundle'
    );

    if (!isBuildOnly) {
      await runVercel(
        ['deploy', '--prebuilt', '--archive=tgz', '--yes', '--target', environment],
        `Deploying ${environment} prebuilt output`
      );
    }

    process.exitCode = 0;
  } catch (error) {
    process.exitCode = 1;
    console.error(`[fast-redeploy] ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    runInFlight = false;

    if (rerunRequested) {
      const nextReason = scheduledReason;
      rerunRequested = false;
      scheduleRun(nextReason);
      return;
    }

    if (!isWatchMode) {
      process.exit(process.exitCode ?? 0);
    }
  }
}

function scheduleRun(reason) {
  scheduledReason = reason;

  if (scheduledRun) {
    clearTimeout(scheduledRun);
  }

  scheduledRun = setTimeout(() => {
    scheduledRun = null;
    void performRun(scheduledReason);
  }, debounceMs);
}

function collectDirectories(rootDirectory) {
  const directories = [rootDirectory];

  for (const entry of readdirSync(rootDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    directories.push(...collectDirectories(join(rootDirectory, entry.name)));
  }

  return directories;
}

function registerWatcher(targetPath) {
  const absoluteTarget = resolve(projectRoot, targetPath);
  const targetStats = statSync(absoluteTarget);

  if (targetStats.isFile()) {
    activeWatchers.push(
      watch(absoluteTarget, () => {
        scheduleRun(`updated ${relative(projectRoot, absoluteTarget)}`);
      })
    );
    return;
  }

  try {
    activeWatchers.push(
      watch(
        absoluteTarget,
        { recursive: true },
        (_eventType, changedPath) => {
          const suffix = changedPath ? changedPath.toString() : relative(projectRoot, absoluteTarget);
          scheduleRun(`updated ${suffix}`);
        }
      )
    );
  } catch {
    for (const directory of collectDirectories(absoluteTarget)) {
      activeWatchers.push(
        watch(directory, (_eventType, changedPath) => {
          const suffix = changedPath
            ? relative(projectRoot, join(directory, changedPath.toString()))
            : relative(projectRoot, directory);
          scheduleRun(`updated ${suffix}`);
        })
      );
    }
  }
}

function closeWatchers() {
  for (const watcher of activeWatchers) {
    watcher.close();
  }

  activeWatchers = [];
}

process.on('SIGINT', () => {
  closeWatchers();
  process.exit(process.exitCode ?? 0);
});

process.on('SIGTERM', () => {
  closeWatchers();
  process.exit(process.exitCode ?? 0);
});

if (isWatchMode) {
  for (const target of watchTargets) {
    registerWatcher(target);
  }

  log(
    `Watching ${watchTargets.length} targets. Environment: ${environment}. Debounce: ${debounceMs}ms.`
  );
}

void performRun(isWatchMode ? 'initial watch run' : 'manual run');

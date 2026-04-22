import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');

const vercelEnv = (process.env.VERCEL_ENV || process.env.VERCEL_TARGET_ENV || '').trim().toLowerCase();
const explicitConfiguration = process.env.VERCEL_ANGULAR_CONFIGURATION?.trim();
const configuration = explicitConfiguration || (vercelEnv === 'production' ? 'production' : 'development');

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

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = process.platform === 'win32'
      ? spawn(windowsShell(), ['/d', '/s', '/c', formatCommand(command, args)], {
          cwd: projectRoot,
          stdio: 'inherit',
          env: process.env,
        })
      : spawn(command, args, {
          cwd: projectRoot,
          stdio: 'inherit',
          env: process.env,
        });

    child.on('error', rejectPromise);
    child.on('exit', code => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Command failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}

console.log(
  `[vercel-build] VERCEL_ENV=${vercelEnv || 'local'} -> Angular configuration: ${configuration}`
);

await run(npxCommand(), ['ng', 'build', '--configuration', configuration]);

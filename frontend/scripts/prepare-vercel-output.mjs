import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(projectRoot, '..');
const distDirectory = resolve(projectRoot, 'dist', 'steamdb-mini-frontend', 'browser');
const outputDirectory = resolve(workspaceRoot, '.vercel', 'output');
const staticDirectory = resolve(outputDirectory, 'static');
const vercelConfigPath = resolve(projectRoot, 'vercel.json');

const vercelConfig = JSON.parse(await readFile(vercelConfigPath, 'utf8'));
const outputConfig = {
  version: 3,
  routes: vercelConfig.routes ?? [],
};

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(staticDirectory, { recursive: true });
await cp(distDirectory, staticDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'config.json'), `${JSON.stringify(outputConfig, null, 2)}\n`, 'utf8');

console.log(`[prepare-vercel-output] Wrote ${outputDirectory}`);

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const defaultApiUrl = 'http://localhost:8000/api';
const configuredApiUrl = process.env.NG_APP_API_URL?.trim() || defaultApiUrl;
const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, '');

const outputPath = resolve('src', 'assets', 'runtime-config.js');
mkdirSync(resolve('src', 'assets'), { recursive: true });

writeFileSync(
  outputPath,
  `window.__APP_CONFIG__ = Object.assign({}, window.__APP_CONFIG__, { apiUrl: ${JSON.stringify(normalizedApiUrl)} });\n`,
  'utf8'
);

console.log(`[runtime-config] API URL: ${normalizedApiUrl}`);

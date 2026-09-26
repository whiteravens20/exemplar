#!/usr/bin/env node
// Copy the non-TypeScript assets into the compiled output. `tsc` only emits
// .js from .ts, so the dashboard's hand-written HTML/CSS/JS under
// src/api/dashboard/public and the translations under src/locales must be
// copied alongside the build.
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const dir of ['api/dashboard/public', 'locales']) {
  const src = join(root, 'src', dir);
  const dest = join(root, 'dist', dir);
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true });
  console.log(`Copied ${dir} → ${dest}`);
}

#!/usr/bin/env node
// Copy the dashboard's static frontend assets into the compiled output. `tsc`
// only emits .js from .ts, so the hand-written HTML/CSS/JS under
// src/api/dashboard/public must be copied alongside the build.
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src/api/dashboard/public');
const dest = join(root, 'dist/api/dashboard/public');

await mkdir(dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`Copied dashboard assets → ${dest}`);

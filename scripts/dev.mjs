#!/usr/bin/env node
// `npm run dev`: build the bot, then start it. Node's watch mode runs this file
// again whenever something under src/ changes, so every edit gets a fresh
// build and a restarted bot.
import { execSync } from 'node:child_process';

try {
  execSync('npm run build', { stdio: 'inherit' });
} catch {
  // tsc has already printed what is wrong; watch mode waits for the next change.
  process.exit(1);
}

await import('../dist/index.js');

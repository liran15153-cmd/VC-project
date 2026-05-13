#!/usr/bin/env node
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '..', '..', 'GAME_ENGINE', 'examples', 'dist');
const DEST = resolve(__dirname, '..', 'public', 'engine-preview');

if (!existsSync(SRC)) {
  console.error(`[copy-engine-preview] source not found: ${SRC}`);
  console.error('[copy-engine-preview] run "npm run build -w gvc-game-engine" first');
  process.exit(1);
}

if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true });
cpSync(SRC, DEST, { recursive: true });
console.log(`[copy-engine-preview] copied ${SRC} -> ${DEST}`);

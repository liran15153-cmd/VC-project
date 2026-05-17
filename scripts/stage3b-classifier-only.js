#!/usr/bin/env node
/* ============================================================================
 * stage3b-classifier-only.js — deterministic Stage 3A validation against the
 * Stage 3B prompt set. Runs without LLM/credits/network. Reports the same
 * classifier metadata that meta.classifier would expose if the real pipeline
 * could run end-to-end.
 *
 * Usage:
 *   node scripts/stage3b-classifier-only.js [--out=classifier-report.json]
 * ========================================================================= */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { classifyArchetype } = require('../prototype/backend/src/classifier');

const OUT_PATH = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? 'stage3b-classifier-report.json';

const PROMPTS = [
  { label: 'Simple 2D platformer', rawPrompt: 'A 2D side-scrolling platformer where a small fox collects acorns and avoids spiked vines.', dimension: '2D', gameType: 'platformer' },
  { label: 'Simple 3D platformer', rawPrompt: 'A 3D low-poly platformer where a robot bounces through floating islands.', dimension: '3D', gameType: 'platformer-3d' },
  { label: 'Top-down shooter', rawPrompt: 'A top-down 2D space shooter where the player avoids asteroids and destroys enemy ships.', dimension: '2D', gameType: 'shooter' },
  { label: 'Hybrid 2.5D runner', rawPrompt: 'A hybrid runner with a Three.js 3D world and a Phaser HUD. The player is an astronaut running on the surface of the moon.', dimension: 'hybrid', gameType: 'runner' },
  { label: 'Small puzzle game', rawPrompt: 'A grid-based puzzle game where the player slides colored blocks into matching targets.', dimension: '2D', gameType: 'puzzle' },
  { label: 'Tower defense with waves', rawPrompt: 'A tower defense where the player places towers on a path to stop waves of enemies before they reach the base.', dimension: '2D', gameType: 'shooter' },
  { label: 'First person maze shooter', rawPrompt: 'A first person maze shooter set in a dim sci-fi corridor; the player aims and shoots small drones.', dimension: '3D', gameType: 'shooter' },
  { label: '3D vehicle racing game', rawPrompt: 'A 3D vehicle racing game where the player drives a fast kart through a desert track.', dimension: '3D', gameType: 'racing' },
  { label: 'Mobile 2.5D endless runner', rawPrompt: 'A mobile endless runner with 2.5D visuals: 3D platforms scrolling toward a 2D-feel character.', dimension: 'hybrid', gameType: 'runner' },
  { label: 'UI-heavy quiz game', rawPrompt: 'A UI-heavy quiz game with multiple-choice trivia about ocean animals; no physics.', dimension: '2D', gameType: 'puzzle' }
];

const EXPECTED = {
  'Simple 2D platformer': 'platformer_2d',
  'Simple 3D platformer': 'platformer_3d',
  'Top-down shooter': 'top_down_2d',
  'Hybrid 2.5D runner': 'hybrid_2_5d',
  'Small puzzle game': 'grid_logic',
  'Tower defense with waves': 'tower_defense',
  'First person maze shooter': 'first_person_3d',
  '3D vehicle racing game': 'vehicle_3d',
  'Mobile 2.5D endless runner': 'hybrid_2_5d',
  'UI-heavy quiz game': 'ui_heavy'
};

console.log('\nLOOMIER Stage 3B — Deterministic Classifier Validation');
console.log('(Real LLM pipeline blocked by OpenRouter 402: out of credits.)\n');

const rows = [];
let okCount = 0;
for (const p of PROMPTS) {
  const result = classifyArchetype({ rawPrompt: p.rawPrompt, dimension: p.dimension, gameType: p.gameType });
  const expected = EXPECTED[p.label];
  const matches = result.archetype === expected;
  if (matches) okCount += 1;
  const flag = matches ? '✓' : '✗';
  console.log(`${flag} ${p.label}`);
  console.log(`    expected=${expected}  got=${result.archetype}`);
  console.log(`    dim=${result.dimension} src=${result.source}/${result.dimensionSource} conf=${result.confidenceScore} reason="${result.reasoningShort}"`);
  if (result.warnings.length) console.log(`    warnings=${JSON.stringify(result.warnings)}`);
  rows.push({ label: p.label, expected, got: result.archetype, matches, ...result });
}

console.log(`\nClassifier accuracy: ${okCount} / ${PROMPTS.length}`);

fs.writeFileSync(path.resolve(OUT_PATH), JSON.stringify({
  timestamp: new Date().toISOString(),
  total: PROMPTS.length,
  okCount,
  rows
}, null, 2));
console.log(`Report saved to ${OUT_PATH}`);
process.exit(okCount === PROMPTS.length ? 0 : 1);

#!/usr/bin/env node
/**
 * Calls the live backend at $BASE (default http://localhost:3000/api),
 * runs /brief/generate then /engine/from-brief for a given prompt+dimension,
 * and writes the resulting GameDefinition to disk so the preview contract
 * smoke runner can replay it.
 *
 * Usage:
 *   node test-fixtures/capture-real-game.mjs <name> <2D|3D|hybrid> <gameType> "<prompt>"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_BASE || 'http://localhost:3000/api';

const [name, dimension, gameType, prompt] = process.argv.slice(2);
if (!name || !dimension || !gameType || !prompt) {
  console.error('usage: capture-real-game.mjs <name> <2D|3D|hybrid> <gameType> "<prompt>"');
  process.exit(2);
}

async function postJSON(p, body) {
  const t0 = Date.now();
  const res = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep raw text */ }
  return { status: res.status, body: json, raw: text, durationMs: Date.now() - t0 };
}

(async () => {
  console.log(`>> brief/generate (${dimension}, ${gameType})`);
  const briefRes = await postJSON('/brief/generate', { prompt, gameType, dimension });
  if (briefRes.status !== 200) {
    console.error('brief/generate failed', briefRes.status, briefRes.raw.slice(0, 400));
    process.exit(1);
  }
  console.log(`   ok in ${briefRes.durationMs}ms — "${briefRes.body.brief.title}"`);

  console.log('>> engine/from-brief');
  const engineRes = await postJSON('/engine/from-brief', {
    prompt, answers: {}, gameType, dimension, brief: briefRes.body.brief, debug: true,
  });
  if (engineRes.status !== 200) {
    console.error('engine/from-brief failed', engineRes.status, engineRes.raw.slice(0, 600));
    process.exit(1);
  }
  console.log(`   ok in ${engineRes.durationMs}ms — model=${engineRes.body.meta?.model} attempts=${engineRes.body.meta?.attempts}`);

  const definition = engineRes.body.gameDefinition;
  if (!definition || typeof definition !== 'object') {
    console.error('no gameDefinition in response');
    process.exit(1);
  }
  const outDir = path.join(__dirname, 'real-captures');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(definition, null, 2));
  console.log(`   wrote ${outPath} (${fs.statSync(outPath).size} bytes)`);

  // Quick stats for the report
  const def = definition;
  const assets = def.assets || [];
  const scenes = def.scenes || [];
  console.log(`   scenes=${scenes.length} assets=${assets.length} entities=${scenes.flatMap((s) => s.entities || []).length} 2D=${def.engine?.enable2D} 3D=${def.engine?.enable3D} physics=${def.engine?.enablePhysics}`);

  const meta = engineRes.body.meta || {};
  console.log(`   meta: selectedAssets=${meta.selectedAssetCount} missing=${meta.missingAssetCount} subs=${meta.substitutionCount} dominantPack=${meta.dominantPack ?? '—'} warnings=${meta.normalizationWarningCount}`);

  console.log(outPath);
})().catch((err) => { console.error(err); process.exit(1); });

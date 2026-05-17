#!/usr/bin/env node
/* ============================================================================
 * stage3b-validation.js — Stage 3B real-pipeline validation reporter
 * ----------------------------------------------------------------------------
 * Sends prompts through /api/brief/generate then /api/engine/from-brief, and
 * captures: classifier metadata, asset usage summary, diagnostics, debug
 * repair status, and the full GameDefinition for the best result.
 *
 * Usage:
 *   node scripts/stage3b-validation.js [--url=http://localhost:3000] [--out=stage3b-report.json]
 * ========================================================================= */

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const BASE_URL = process.argv.find((a) => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:3000';
const OUT_PATH = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? 'stage3b-report.json';

const SAMPLE_PROMPTS = [
  {
    label: 'Simple 2D platformer',
    body: { prompt: 'A 2D side-scrolling platformer where a small fox collects acorns and avoids spiked vines.', answers: {}, gameType: 'platformer', dimension: '2D' }
  },
  {
    label: 'Simple 3D platformer',
    body: { prompt: 'A 3D low-poly platformer where a robot bounces through floating islands.', answers: {}, gameType: 'platformer-3d', dimension: '3D' }
  },
  {
    label: 'Top-down shooter',
    body: { prompt: 'A top-down 2D space shooter where the player avoids asteroids and destroys enemy ships.', answers: {}, gameType: 'shooter', dimension: '2D' }
  },
  {
    label: 'Hybrid 2.5D runner',
    body: { prompt: 'A hybrid runner with a Three.js 3D world and a Phaser HUD. The player is an astronaut running on the surface of the moon.', answers: {}, gameType: 'runner', dimension: 'hybrid' }
  },
  {
    label: 'Small puzzle game',
    body: { prompt: 'A grid-based puzzle game where the player slides colored blocks into matching targets.', answers: {}, gameType: 'puzzle', dimension: '2D' }
  },
  {
    label: 'Tower defense with waves',
    body: { prompt: 'A tower defense where the player places towers on a path to stop waves of enemies before they reach the base.', answers: {}, gameType: 'shooter', dimension: '2D' }
  },
  {
    label: 'First person maze shooter',
    body: { prompt: 'A first person maze shooter set in a dim sci-fi corridor; the player aims and shoots small drones.', answers: {}, gameType: 'shooter', dimension: '3D' }
  },
  {
    label: '3D vehicle racing game',
    body: { prompt: 'A 3D vehicle racing game where the player drives a fast kart through a desert track.', answers: {}, gameType: 'racing', dimension: '3D' }
  },
  {
    label: 'Mobile 2.5D endless runner',
    body: { prompt: 'A mobile endless runner with 2.5D visuals: 3D platforms scrolling toward a 2D-feel character.', answers: {}, gameType: 'runner', dimension: 'hybrid' }
  },
  {
    label: 'UI-heavy quiz game',
    body: { prompt: 'A UI-heavy quiz game with multiple-choice trivia about ocean animals; no physics.', answers: {}, gameType: 'puzzle', dimension: '2D' }
  }
];

async function postJson(pathname, body, timeoutMs = 240_000) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  return { res: response, data };
}

function summarizeClassifier(c) {
  if (!c) return null;
  return {
    archetype: c.archetype,
    dimension: c.dimension,
    source: c.source,
    dimensionSource: c.dimensionSource,
    confidenceScore: c.confidenceScore,
    reasoningShort: c.reasoningShort,
    warningsCount: (c.warnings || []).length
  };
}

async function runSample(sample, index) {
  const label = `[${index + 1}/${SAMPLE_PROMPTS.length}] ${sample.label}`;
  process.stdout.write(`${label}\n`);

  process.stdout.write(`  brief … `);
  let briefStep;
  try {
    briefStep = await postJson('/api/brief/generate', { ...sample.body });
  } catch (err) {
    console.log(`NETWORK ERROR — ${err.message}`);
    return { label: sample.label, status: 'network-error', stage: 'brief', error: err.message };
  }
  if (!briefStep.res.ok) {
    console.log(`API ERROR ${briefStep.res.status}`);
    return { label: sample.label, status: 'api-error', stage: 'brief', httpStatus: briefStep.res.status, error: briefStep.data?.error };
  }
  const brief = briefStep.data.brief;
  const classifier = summarizeClassifier(briefStep.data.meta?.classifier);
  const briefFallback = !!briefStep.data.meta?.fallback;
  console.log(`ok (${briefFallback ? 'fallback' : 'real'} ${Math.round((briefStep.data.meta?.durationMs || 0) / 1000)}s) archetype=${classifier?.archetype} src=${classifier?.source}/${classifier?.dimensionSource} conf=${classifier?.confidenceScore}`);

  process.stdout.write(`  engine … `);
  let engineStep;
  try {
    engineStep = await postJson('/api/engine/from-brief', { ...sample.body, brief, debug: true });
  } catch (err) {
    console.log(`NETWORK ERROR — ${err.message}`);
    return { label: sample.label, status: 'network-error', stage: 'engine', classifier, briefFallback, error: err.message };
  }
  if (!engineStep.res.ok) {
    console.log(`API ERROR ${engineStep.res.status}`);
    return { label: sample.label, status: 'api-error', stage: 'engine', classifier, briefFallback, httpStatus: engineStep.res.status, error: engineStep.data?.error };
  }

  const data = engineStep.data;
  const diagnostics = Array.isArray(data.debugDiagnostics) ? data.debugDiagnostics : [];
  const summary = data.debugDiagnosticsSummary || {};
  const repair = data.debugRepair || {};
  const normWarn = Array.isArray(data.normalizationWarnings) ? data.normalizationWarnings.length : 0;
  const created = !!(data.gameDefinition && data.gameDefinition.scenes?.length > 0);
  const assetUsage = data.assetUsageSummary || {};
  const generationContractIssueCount = data.meta?.generationContractIssueCount ?? 0;

  const topCodes = Object.entries(summary.codes || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([code, count]) => `${code}×${count}`).join(', ') || 'none';

  console.log(`ok (${Math.round((data.meta?.durationMs || 0) / 1000)}s, ${data.meta?.attempts} attempt(s))`);
  console.log(`    created=${created ? 'yes' : 'no'}  diagnostics=${diagnostics.length}(${summary.errorCount ?? 0}err/${summary.warningCount ?? 0}warn)  normWarn=${normWarn}  topCodes=[${topCodes}]`);
  console.log(`    asset: allowed=${assetUsage.allowedAssetCount ?? 0} used=${assetUsage.usedAssetCount ?? 0} unused=${assetUsage.unusedAssetCount ?? 0} invalid=${(assetUsage.invalidAssetKeys || []).length}`);
  if ((assetUsage.invalidAssetKeys || []).length) console.log(`      invalidAssetKeys=${JSON.stringify(assetUsage.invalidAssetKeys)}`);
  console.log(`    repair: attempted=${!!repair.attempted}  accepted=${!!repair.accepted}  appliedPatches=${repair.appliedPatches?.length || 0}  skipped=${repair.skippedCount || 0}`);

  return {
    label: sample.label,
    status: 'ok',
    created,
    attempts: data.meta?.attempts,
    durationMs: data.meta?.durationMs,
    model: data.meta?.model,
    classifier,
    briefFallback,
    diagnosticCount: diagnostics.length,
    errorCount: summary.errorCount ?? 0,
    warningCount: summary.warningCount ?? 0,
    normalizationWarningCount: normWarn,
    topCodes,
    generationContractIssueCount,
    assetUsageSummary: assetUsage,
    repairAttempted: !!repair.attempted,
    repairAccepted: !!repair.accepted,
    repairPatchCount: repair.appliedPatches?.length || 0,
    repairSkipped: repair.skippedCount || 0,
    gameDefinition: data.gameDefinition,
    selectedAssets: data.selectedAssets || [],
    brief
  };
}

function scoreResult(r) {
  if (r.status !== 'ok' || !r.created) return -Infinity;
  const invalid = (r.assetUsageSummary?.invalidAssetKeys || []).length;
  const errors = r.errorCount || 0;
  const warn = r.warningCount || 0;
  const attempts = r.attempts || 1;
  // lower invalid keys + lower errors + fewer attempts → higher score; small bias for accepted repair
  return -(invalid * 100) - (errors * 10) - (warn * 1) - (attempts * 2) + (r.repairAccepted ? 1 : 0);
}

async function main() {
  console.log(`\nLOOMIER Stage 3B — Real Pipeline Validation`);
  console.log(`Backend: ${BASE_URL}\n`);

  const results = [];
  for (let i = 0; i < SAMPLE_PROMPTS.length; i++) {
    try {
      results.push(await runSample(SAMPLE_PROMPTS[i], i));
    } catch (err) {
      console.error('  fatal:', err.message);
      results.push({ label: SAMPLE_PROMPTS[i].label, status: 'fatal', error: err.message });
    }
  }

  console.log('\n── Per-prompt summary ──────────────────────────────────');
  for (const r of results) {
    if (r.status !== 'ok') {
      console.log(`  ${r.label}: ${r.status} (stage=${r.stage || '?'})`);
      continue;
    }
    const c = r.classifier || {};
    const a = r.assetUsageSummary || {};
    console.log(`  ${r.label}:`);
    console.log(`    classifier: archetype=${c.archetype} src=${c.source}/${c.dimensionSource} conf=${c.confidenceScore}`);
    console.log(`    engine: created=${r.created} attempts=${r.attempts} errors=${r.errorCount} warn=${r.warningCount} contract=${r.generationContractIssueCount}`);
    console.log(`    assets: allowed=${a.allowedAssetCount ?? 0} used=${a.usedAssetCount ?? 0} unused=${a.unusedAssetCount ?? 0} invalid=${(a.invalidAssetKeys || []).length}`);
    console.log(`    repair: accepted=${r.repairAccepted} patches=${r.repairPatchCount} skipped=${r.repairSkipped}`);
  }

  const codeCounts = {};
  for (const r of results) {
    if (r.status !== 'ok') continue;
    for (const entry of (r.topCodes || '').split(', ')) {
      const m = entry.match(/^([A-Z_]+)×(\d+)$/);
      if (m) codeCounts[m[1]] = (codeCounts[m[1]] || 0) + Number(m[2]);
    }
  }
  if (Object.keys(codeCounts).length) {
    console.log('\n── Top recurring diagnostic codes ───────────────────────');
    Object.entries(codeCounts).sort((a, b) => b[1] - a[1]).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
  }

  const successCount = results.filter((r) => r.status === 'ok' && r.created).length;
  console.log(`\nSuccess: ${successCount} / ${results.length}`);

  // pick best playable
  const best = results.filter((r) => r.status === 'ok' && r.created).sort((a, b) => scoreResult(b) - scoreResult(a))[0];
  if (best) {
    console.log(`\nBest playable: ${best.label}  (score=${scoreResult(best)})`);
    console.log(`  archetype=${best.classifier?.archetype}  invalidAssetKeys=${(best.assetUsageSummary.invalidAssetKeys || []).length}`);
  }

  const reportPath = path.resolve(OUT_PATH);
  await fs.writeFile(reportPath, JSON.stringify({
    baseUrl: BASE_URL,
    timestamp: new Date().toISOString(),
    successCount,
    total: results.length,
    bestLabel: best?.label || null,
    results
  }, null, 2));
  console.log(`\nReport saved to ${reportPath}`);

  process.exit(results.every((r) => r.status === 'ok' && r.created) ? 0 : 1);
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});

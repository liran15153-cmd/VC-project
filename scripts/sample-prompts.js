#!/usr/bin/env node
/* ============================================================================
 * sample-prompts.js — Stage 1.5 diagnostic sampling script
 * ----------------------------------------------------------------------------
 * Sends 5 representative prompts through the /api/engine/from-brief pipeline
 * and records: GameDefinition created?, diagnostics count, top codes, and
 * whether the response shape includes debugDiagnostics.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-... node scripts/sample-prompts.js [--url=http://localhost:3000]
 *
 * Without a real API key the backend returns 503; the script handles that and
 * reports "api-error" for each case. Run with a real key to see real results.
 * ========================================================================= */

'use strict';

const BASE_URL = process.argv.find((a) => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:3000';

const SAMPLE_PROMPTS = [
  {
    label: 'Simple 2D platformer',
    body: {
      prompt: 'A 2D side-scrolling platformer where a small fox collects acorns and avoids spiked vines.',
      answers: { pace: 'medium', visual_style: 'cartoon' },
      gameType: 'platformer',
      dimension: '2D'
    }
  },
  {
    label: 'Simple 3D platformer',
    body: {
      prompt: 'A 3D low-poly platformer where a robot bounces through floating islands.',
      answers: { pace: 'fast', visual_style: 'low_poly' },
      gameType: 'platformer-3d',
      dimension: '3D'
    }
  },
  {
    label: 'Top-down shooter',
    body: {
      prompt: 'A top-down 2D space shooter where the player avoids asteroids and destroys enemy ships.',
      answers: { pace: 'fast', difficulty: 'medium' },
      gameType: 'shooter',
      dimension: '2D'
    }
  },
  {
    label: 'Hybrid 2.5D runner',
    body: {
      prompt: 'A hybrid runner with a Three.js 3D world and a Phaser HUD. The player is an astronaut running on the surface of the moon.',
      answers: { pace: 'fast', visual_style: 'sci_fi' },
      gameType: 'runner',
      dimension: 'hybrid'
    }
  },
  {
    label: 'Small puzzle game',
    body: {
      prompt: 'A grid-based puzzle game where the player slides colored blocks into matching targets.',
      answers: { pace: 'slow', difficulty: 'easy' },
      gameType: 'puzzle',
      dimension: '2D'
    }
  }
];

async function postJson(path, body, timeoutMs = 180_000) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  return { res: response, data };
}

async function runSample(sample, index) {
  const label = `[${index + 1}/${SAMPLE_PROMPTS.length}] ${sample.label}`;
  process.stdout.write(`${label}\n`);

  // Step 1: generate a brief from the prompt (no MCQ — empty answers).
  process.stdout.write(`  brief … `);
  let briefStep;
  try {
    briefStep = await postJson('/api/brief/generate', {
      prompt: sample.body.prompt,
      answers: sample.body.answers || {},
      gameType: sample.body.gameType,
      dimension: sample.body.dimension
    });
  } catch (err) {
    console.log(`NETWORK ERROR — ${err.message}`);
    return { label: sample.label, status: 'network-error', stage: 'brief', error: err.message };
  }
  if (!briefStep.res.ok) {
    console.log(`API ERROR ${briefStep.res.status} — ${briefStep.data?.error || JSON.stringify(briefStep.data).slice(0, 200)}`);
    return { label: sample.label, status: 'api-error', stage: 'brief', httpStatus: briefStep.res.status, error: briefStep.data?.error };
  }
  const brief = briefStep.data.brief;
  const briefFallback = briefStep.data.meta?.fallback;
  console.log(`ok (${briefFallback ? 'fallback' : 'real'} ${Math.round((briefStep.data.meta?.durationMs || 0) / 1000)}s)`);

  // Step 2: engine/from-brief — this is where diagnostics + repair run.
  process.stdout.write(`  engine … `);
  let engineStep;
  try {
    engineStep = await postJson('/api/engine/from-brief', {
      prompt: sample.body.prompt,
      answers: sample.body.answers || {},
      gameType: sample.body.gameType,
      dimension: sample.body.dimension,
      brief
    });
  } catch (err) {
    console.log(`NETWORK ERROR — ${err.message}`);
    return { label: sample.label, status: 'network-error', stage: 'engine', error: err.message };
  }
  if (!engineStep.res.ok) {
    console.log(`API ERROR ${engineStep.res.status} — ${engineStep.data?.error || JSON.stringify(engineStep.data).slice(0, 200)}`);
    return { label: sample.label, status: 'api-error', stage: 'engine', httpStatus: engineStep.res.status, error: engineStep.data?.error };
  }

  const data = engineStep.data;
  const diagnostics = Array.isArray(data.debugDiagnostics) ? data.debugDiagnostics : [];
  const summary = data.debugDiagnosticsSummary || {};
  const repair = data.debugRepair || {};
  const normWarn = Array.isArray(data.normalizationWarnings) ? data.normalizationWarnings.length : 0;
  const created = !!(data.gameDefinition && data.gameDefinition.scenes?.length > 0);

  const topCodes = Object.entries(summary.codes || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => `${code}×${count}`)
    .join(', ') || 'none';

  console.log(`ok (${Math.round((data.meta?.durationMs || 0) / 1000)}s, ${data.meta?.attempts}attempt(s))`);
  console.log(`    created=${created ? 'yes' : 'no'}  diagnostics=${diagnostics.length}(${summary.errorCount ?? 0}err/${summary.warningCount ?? 0}warn)  normWarnings=${normWarn}  topCodes=[${topCodes}]`);
  console.log(`    repair: attempted=${!!repair.attempted}  accepted=${!!repair.accepted}  appliedPatches=${repair.appliedPatches?.length || 0}  skipped=${repair.skippedCount || 0}`);
  if (repair.appliedPatches?.length) {
    for (const p of repair.appliedPatches.slice(0, 3)) {
      console.log(`      patch: ${p.op} ${p.path} → ${JSON.stringify(p.value)} [${p.diagnosticCode}]`);
    }
  }

  return {
    label: sample.label,
    status: 'ok',
    created,
    attempts: data.meta?.attempts,
    diagnosticCount: diagnostics.length,
    errorCount: summary.errorCount ?? 0,
    warningCount: summary.warningCount ?? 0,
    normalizationWarningCount: normWarn,
    topCodes,
    repairAttempted: !!repair.attempted,
    repairAccepted: !!repair.accepted,
    repairPatchCount: repair.appliedPatches?.length || 0,
    repairSkipped: repair.skippedCount || 0,
    model: data.meta?.model,
    briefFallback
  };
}

async function main() {
  console.log(`\nLOOMIER Stage 1.5 — Sample Prompt Diagnostics Report`);
  console.log(`Backend: ${BASE_URL}\n`);

  const results = [];
  for (let i = 0; i < SAMPLE_PROMPTS.length; i++) {
    results.push(await runSample(SAMPLE_PROMPTS[i], i));
  }

  console.log('\n── Summary ──────────────────────────────────────────────');
  for (const r of results) {
    if (r.status !== 'ok') {
      console.log(`  ${r.label}: ${r.status} (stage=${r.stage || '?'}, http=${r.httpStatus || '?'})`);
      continue;
    }
    console.log(`  ${r.label}:`);
    console.log(`    created=${r.created}  attempts=${r.attempts}  errors=${r.errorCount}  warnings=${r.warningCount}  normWarn=${r.normalizationWarningCount}`);
    console.log(`    top codes: ${r.topCodes}`);
    console.log(`    repair: attempted=${r.repairAttempted}  accepted=${r.repairAccepted}  patches=${r.repairPatchCount}`);
  }

  // Aggregate top diagnostic codes across all prompts
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

  const allOk = results.every((r) => r.status === 'ok');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});

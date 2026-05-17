#!/usr/bin/env tsx
/**
 * End-to-end contract verification for the LOOMIER preview iframe.
 *
 * Loads every GameDefinition fixture in test-fixtures/game-definitions/ (and
 * any extra payloads passed via --file=) and drives them through the real
 * PreviewController (from GAME_ENGINE/src — run via tsx) using mock engine +
 * runtime factories. This proves the protocol + lifecycle layer works
 * end-to-end without needing a real browser/WebGL context.
 *
 * Usage:
 *   npx tsx test-fixtures/preview-contract-smoke.ts
 *   npx tsx test-fixtures/preview-contract-smoke.ts --file=/path/to/real-ai-output.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PreviewController,
  isPreviewCommand,
  isPreviewEvent,
  PREVIEW_PROTOCOL_VERSION,
  type PreviewEvent,
  type PreviewErrorCategory,
  type PreviewEngineFactory,
  type PreviewRuntimeFactory,
} from '../GAME_ENGINE/src/preview';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(__dirname, 'game-definitions');

interface Expectation {
  outcome: 'loaded' | PreviewErrorCategory;
  expectWarnings?: boolean;
  /** Specific warning codes that MUST appear in the loaded summary. */
  requiredWarningCodes?: string[];
}

const FIXTURE_EXPECTATIONS: Record<string, Expectation> = {
  'valid-2d.json':                    { outcome: 'loaded' },
  'valid-3d.json':                    { outcome: 'loaded' },
  'valid-hybrid.json':                { outcome: 'loaded' },
  'normalized-ai-shaped-output.json': { outcome: 'loaded', expectWarnings: true },
  'missing-asset-references.json':    { outcome: 'asset-missing-reference' },
  'wrong-asset-type-references.json': { outcome: 'asset-missing-reference' },
  // AI drift coverage — each must reach preview:loaded with the matching warning code.
  'drift-02-fontsize-number.json':    { outcome: 'loaded', requiredWarningCodes: ['normalized.styleFontSize'] },
  'drift-03-missing-collider.json':   { outcome: 'loaded', requiredWarningCodes: ['normalized.colliderInferred'] },
  'drift-04-sensor-type.json':        { outcome: 'loaded', requiredWarningCodes: ['normalized.rigidBodyTypeSensor'] },
  'drift-05-vec3-arrays.json':        { outcome: 'loaded', requiredWarningCodes: ['normalized.vec3FromArray'] },
  'drift-06-unknown-systems.json':    { outcome: 'loaded', requiredWarningCodes: ['normalized.sceneSystemUnknown'] },
  'drift-07-cameratarget-bool.json':  { outcome: 'loaded', requiredWarningCodes: ['normalized.cameraTargetBoolean'] },
  'drift-08-sprite-missing-kind.json':{ outcome: 'loaded', requiredWarningCodes: ['normalized.spriteImageKind'] },
};

const ANSI = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m',
} as const;
let exitCode = 0;
const log  = (...a: unknown[]) => console.log(...a);
const pass = (msg: string) => { log(`  ${ANSI.green}PASS${ANSI.reset} ${msg}`); };
const fail = (msg: string) => { log(`  ${ANSI.red}FAIL${ANSI.reset} ${msg}`); exitCode = 1; };
const info = (msg: string) => { log(`  ${ANSI.gray}··${ANSI.reset} ${msg}`); };

// ─── Mock engine / runtime ─────────────────────────────────────────────────

interface MockEngine {
  init: () => Promise<void>;
  start: () => void;
  destroy: () => void;
  pause: () => void;
  resume: () => void;
}
interface MockRuntime { load: (def: unknown) => Promise<void>; }

const makeMockEngine = (): MockEngine => ({
  init: async () => {}, start: () => {}, destroy: () => {}, pause: () => {}, resume: () => {},
});
const makeMockRuntime = (): MockRuntime => ({ load: async () => {} });
const makeFailingEngine  = (m: string): MockEngine => ({ ...makeMockEngine(), init: async () => { throw new Error(m); } });
const makeFailingRuntime = (m: string): MockRuntime => ({ load: async () => { throw new Error(m); } });
const makeContainer = (): HTMLElement => ({ replaceChildren: () => {} } as unknown as HTMLElement);

const engineFactoryOk: PreviewEngineFactory   = (() => makeMockEngine()) as unknown as PreviewEngineFactory;
const runtimeFactoryOk: PreviewRuntimeFactory = (() => makeMockRuntime()) as unknown as PreviewRuntimeFactory;

// ─── One fixture drive ────────────────────────────────────────────────────

interface DriveArgs {
  name: string;
  definition: unknown;
  expected: Expectation;
  engineFactory?: PreviewEngineFactory;
  runtimeFactory?: PreviewRuntimeFactory;
}

async function driveFixture({ name, definition, expected, engineFactory, runtimeFactory }: DriveArgs) {
  log(`\n${ANSI.bold}${ANSI.cyan}=== ${name} ===${ANSI.reset}`);
  const events: PreviewEvent[] = [];
  const controller = new PreviewController({
    container: makeContainer(),
    emit: (e) => events.push(e),
    engineFactory: engineFactory ?? engineFactoryOk,
    runtimeFactory: runtimeFactory ?? runtimeFactoryOk,
    now: () => 1_000_000,
  });

  controller.announce('http://localhost:5173');
  const hello = events.find((e) => e.type === 'preview:hello');
  if (!hello) fail('hello not emitted');
  else if (hello.protocolVersion !== PREVIEW_PROTOCOL_VERSION) fail(`hello protocolVersion=${hello.protocolVersion}, expected ${PREVIEW_PROTOCOL_VERSION}`);
  else pass(`hello emitted (v${hello.protocolVersion})`);

  const requestId = `smoke-${Math.random().toString(36).slice(2)}`;
  const command = { v: PREVIEW_PROTOCOL_VERSION, type: 'preview:load' as const, requestId, gameDefinition: definition };
  if (!isPreviewCommand(command)) fail('crafted load command failed isPreviewCommand'); else pass('load command passes isPreviewCommand');

  events.length = 0;
  await controller.handleCommand(command);
  if (!events.every((e) => isPreviewEvent(e))) fail('controller emitted an event that fails isPreviewEvent');
  else pass(`controller emitted ${events.length} valid events`);

  const phases = events.filter((e) => e.type === 'preview:loading').map((e) => e.phase);
  if (phases.length > 0) info(`phases: ${phases.join(' → ')}`);

  const loaded = events.find((e) => e.type === 'preview:loaded');
  const errored = events.find((e) => e.type === 'preview:error');

  if (expected.outcome === 'loaded') {
    if (loaded && !errored) {
      pass(`preview:loaded reached for "${loaded.summary.title}"`);
      if (loaded.requestId !== requestId) fail(`loaded.requestId ${loaded.requestId} ≠ ${requestId}`);
      else pass('loaded echoes correct requestId');
      info(`summary: ${loaded.summary.sceneCount} scene(s) | ${loaded.summary.assetCount} asset(s) | 2D=${loaded.summary.uses2D} 3D=${loaded.summary.uses3D} physics=${loaded.summary.usesPhysics}`);
      if (expected.expectWarnings) {
        if (loaded.warnings.length === 0) fail('expected normalization warnings, got none');
        else pass(`got ${loaded.warnings.length} normalization warning(s)`);
      } else info(`warnings: ${loaded.warnings.length}`);
      if (expected.requiredWarningCodes?.length) {
        const codes = new Set(loaded.warnings.map((w) => w.code));
        for (const required of expected.requiredWarningCodes) {
          if (codes.has(required)) pass(`required warning code "${required}" present`);
          else fail(`missing required warning code "${required}" (got: ${[...codes].join(', ') || 'none'})`);
        }
      }
      if (controller.getMode() !== 'running') fail(`mode=${controller.getMode()}, expected running`);
      else pass('mode=running');
    } else {
      fail(`expected preview:loaded, got error category=${errored?.error?.category ?? 'none'} message=${errored?.error?.message ?? 'n/a'}`);
    }
  } else {
    if (errored && !loaded) {
      if (errored.error.category === expected.outcome) {
        pass(`preview:error with expected category "${expected.outcome}"`);
        info(`message: ${errored.error.message}`);
      } else {
        fail(`error category=${errored.error.category}, expected ${expected.outcome} (${errored.error.message})`);
      }
      if (controller.getMode() !== 'error') fail(`mode=${controller.getMode()}, expected error`);
      else pass('mode=error');
    } else {
      fail(`expected error category=${expected.outcome}, got loaded=${!!loaded}`);
    }
  }
  return { controller, events, requestId };
}

// ─── Lifecycle sweep ──────────────────────────────────────────────────────

async function lifecycleSweep(name: string, definition: unknown) {
  log(`\n${ANSI.bold}${ANSI.yellow}=== lifecycle sweep on ${name} ===${ANSI.reset}`);

  // Multi-load: verify previous engine is destroyed before next one boots.
  let destroyCalls = 0;
  const ctrlMulti = new PreviewController({
    container: makeContainer(),
    emit: () => {},
    engineFactory: ((() => {
      const e = makeMockEngine();
      e.destroy = () => { destroyCalls++; };
      return e;
    }) as unknown) as PreviewEngineFactory,
    runtimeFactory: runtimeFactoryOk,
  });
  ctrlMulti.announce('http://x');
  await ctrlMulti.handleCommand({ v: 1, type: 'preview:load', requestId: 'a', gameDefinition: definition });
  await ctrlMulti.handleCommand({ v: 1, type: 'preview:load', requestId: 'b', gameDefinition: definition });
  if (destroyCalls >= 1) pass(`multi-load tore down previous engine (destroy called ${destroyCalls}x)`);
  else fail('multi-load did NOT destroy previous engine');

  // Pause / resume / snapshot / destroy on a fresh controller.
  const evs: PreviewEvent[] = [];
  const ctrl = new PreviewController({
    container: makeContainer(),
    emit: (e) => evs.push(e),
    engineFactory: engineFactoryOk,
    runtimeFactory: runtimeFactoryOk,
    now: () => 5000,
  });
  ctrl.announce('http://x');
  await ctrl.handleCommand({ v: 1, type: 'preview:load', requestId: 'L', gameDefinition: definition });

  await ctrl.handleCommand({ v: 1, type: 'preview:pause',  requestId: 'p1' });
  if (ctrl.getMode() === 'paused') pass('pause → paused'); else fail(`pause mode=${ctrl.getMode()}`);
  await ctrl.handleCommand({ v: 1, type: 'preview:resume', requestId: 'p2' });
  if (ctrl.getMode() === 'running') pass('resume → running'); else fail(`resume mode=${ctrl.getMode()}`);

  evs.length = 0;
  await ctrl.handleCommand({ v: 1, type: 'preview:get-snapshot', requestId: 'snap' });
  const snap = evs.find((e) => e.type === 'preview:snapshot');
  if (!snap) fail('snapshot not emitted');
  else if (snap.snapshot.mode !== 'running') fail(`snapshot.mode=${snap.snapshot.mode}, expected running`);
  else pass(`snapshot mode=${snap.snapshot.mode} title="${snap.snapshot.title}"`);

  await ctrl.handleCommand({ v: 1, type: 'preview:destroy', requestId: 'D' });
  if (ctrl.getMode() === 'idle') pass('destroy → idle'); else fail(`destroy mode=${ctrl.getMode()}`);

  // Categorised error paths
  const eng: PreviewEvent[] = [];
  const ctrlEngErr = new PreviewController({
    container: makeContainer(),
    emit: (e) => eng.push(e),
    engineFactory: (() => makeFailingEngine('Rapier WASM failed')) as unknown as PreviewEngineFactory,
    runtimeFactory: runtimeFactoryOk,
  });
  await ctrlEngErr.handleCommand({ v: 1, type: 'preview:load', requestId: 'eng', gameDefinition: definition });
  const eErr = eng.find((e) => e.type === 'preview:error');
  if (eErr?.error.category === 'engine-init') pass(`engine init failure → category=${eErr.error.category}`);
  else fail(`expected engine-init, got ${eErr?.error.category}`);

  const rt: PreviewEvent[] = [];
  const ctrlRtErr = new PreviewController({
    container: makeContainer(),
    emit: (e) => rt.push(e),
    engineFactory: engineFactoryOk,
    runtimeFactory: (() => makeFailingRuntime('Failed to load image asset "x" from /missing.png.')) as unknown as PreviewRuntimeFactory,
  });
  await ctrlRtErr.handleCommand({ v: 1, type: 'preview:load', requestId: 'rt', gameDefinition: definition });
  const rErr = rt.find((e) => e.type === 'preview:error');
  if (rErr?.error.category === 'asset-load') pass(`runtime asset failure → category=${rErr.error.category}`);
  else fail(`expected asset-load, got ${rErr?.error.category}`);
}

// ─── Asset disk check ──────────────────────────────────────────────────────

function checkAssetsOnDisk(name: string, definition: { assets?: Array<{ key: string; type: string; url: string }> }) {
  log(`\n${ANSI.bold}${ANSI.cyan}=== asset disk check: ${name} ===${ANSI.reset}`);
  const assets = definition.assets ?? [];
  if (assets.length === 0) { info('no external assets — pure procedural'); return { total: 0, missing: 0 }; }
  let missing = 0;
  for (const a of assets) {
    const url = String(a.url || '');
    const rel = url.replace(/^\//, '');
    const inPublic = path.join(REPO_ROOT, 'public', rel);
    const inRepo = path.join(REPO_ROOT, rel);
    const exists = fs.existsSync(inPublic) || fs.existsSync(inRepo);
    if (exists) info(`OK   ${a.type.padEnd(12)} ${url}`);
    else { info(`${ANSI.yellow}MISS ${a.type.padEnd(12)} ${url}${ANSI.reset}`); missing++; }
  }
  if (missing > 0) info(`${ANSI.yellow}${missing}/${assets.length} asset URLs missing on disk — would hit asset-load in real browser${ANSI.reset}`);
  else info('all asset URLs resolve to real files on disk');
  return { total: assets.length, missing };
}

// ─── Protocol guard self-checks ────────────────────────────────────────────

function selfChecks() {
  log(`\n${ANSI.bold}${ANSI.cyan}=== protocol self-checks ===${ANSI.reset}`);
  const cases: Array<[unknown, boolean, string]> = [
    [{}, false, 'empty'],
    [{ v: 0, type: 'preview:load', requestId: 'x', gameDefinition: {} }, false, 'wrong version'],
    [{ v: 1, type: 'preview:unknown', requestId: 'x' }, false, 'unknown type'],
    [{ v: 1, type: 'preview:load', requestId: '' }, false, 'empty requestId'],
    [{ v: 1, type: 'preview:load', requestId: 'x' }, false, 'missing gameDefinition'],
    [{ v: 1, type: 'preview:load', requestId: 'x', gameDefinition: {} }, true, 'well-formed load'],
    [{ v: 1, type: 'preview:reload', requestId: 'x' }, true, 'well-formed reload'],
  ];
  for (const [input, expected, label] of cases) {
    const got = isPreviewCommand(input);
    if (got === expected) pass(`isPreviewCommand(${label}) = ${expected}`);
    else fail(`isPreviewCommand(${label}) = ${got}, expected ${expected}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

async function main() {
  log(`${ANSI.bold}LOOMIER preview contract smoke${ANSI.reset}`);

  const extraFiles = process.argv.slice(2).filter((a) => a.startsWith('--file=')).map((a) => a.slice('--file='.length));

  selfChecks();

  for (const [name, expected] of Object.entries(FIXTURE_EXPECTATIONS)) {
    const definition = loadFixture(name);
    await driveFixture({ name, definition, expected });
  }

  const aiPath = path.join(REPO_ROOT, 'GAME_ENGINE/examples/ai-game-definition.json');
  if (fs.existsSync(aiPath)) {
    log(`\n${ANSI.bold}${ANSI.cyan}=== bundled AI sample ===${ANSI.reset}`);
    const definition = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
    await driveFixture({ name: 'ai-game-definition.json', definition, expected: { outcome: 'loaded' } });
    checkAssetsOnDisk('ai-game-definition.json', definition as { assets?: Array<{ key: string; type: string; url: string }> });
    await lifecycleSweep('ai-game-definition.json', definition);
  }

  for (const filePath of extraFiles) {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    log(`\n${ANSI.bold}${ANSI.cyan}=== external: ${abs} ===${ANSI.reset}`);
    const definition = JSON.parse(fs.readFileSync(abs, 'utf8'));
    await driveFixture({ name: path.basename(abs), definition, expected: { outcome: 'loaded' } });
    checkAssetsOnDisk(path.basename(abs), definition as { assets?: Array<{ key: string; type: string; url: string }> });
  }

  for (const name of Object.keys(FIXTURE_EXPECTATIONS)) {
    if (FIXTURE_EXPECTATIONS[name].outcome !== 'loaded') continue;
    checkAssetsOnDisk(name, loadFixture(name) as { assets?: Array<{ key: string; type: string; url: string }> });
  }

  log(`\n${ANSI.bold}${exitCode ? ANSI.red + 'SMOKE FAILED' : ANSI.green + 'SMOKE PASSED'}${ANSI.reset}`);
  process.exit(exitCode);
}

main().catch((err) => { console.error(err); process.exit(1); });

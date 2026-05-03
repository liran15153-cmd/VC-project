import { Engine, ENGINE_CAPABILITIES, GameRuntime, parseGameDefinition, type GameDefinition } from '../src';

type GeneratedKind = 'coin' | 'survival' | 'quest';
type GenerationMode = 'backend' | 'local' | 'json';

interface EngineGenerationResponse {
  gameDefinition?: unknown;
  meta?: {
    model?: string;
    durationMs?: number;
    attempts?: number;
  };
  error?: string;
  code?: string;
  details?: unknown;
}

const gameRoot = document.querySelector<HTMLDivElement>('#game-root')!;
const promptInput = document.querySelector<HTMLTextAreaElement>('#prompt')!;
const jsonInput = document.querySelector<HTMLTextAreaElement>('#json')!;
const apiBaseInput = document.querySelector<HTMLInputElement>('#api-base')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;
const metricType = document.querySelector<HTMLElement>('#metric-type')!;
const metricScene = document.querySelector<HTMLElement>('#metric-scene')!;
const metricState = document.querySelector<HTMLElement>('#metric-state')!;
const metricSystems = document.querySelector<HTMLElement>('#metric-systems')!;
const capabilitiesEl = document.querySelector<HTMLDivElement>('#capabilities')!;

let engine: Engine | null = null;
let runtime: GameRuntime | null = null;
let stateUnsubscribe: (() => void) | null = null;
let sceneUnsubscribe: (() => void) | null = null;

const API_BASE_STORAGE_KEY = 'gvc.engineLab.apiBase';
const savedApiBase = localStorage.getItem(API_BASE_STORAGE_KEY);
if (savedApiBase) apiBaseInput.value = savedApiBase;

renderCapabilities();
wireUi();
void loadLocalStarter();

function wireUi(): void {
  apiBaseInput.addEventListener('change', () => {
    localStorage.setItem(API_BASE_STORAGE_KEY, apiBaseInput.value.trim());
  });
  document.querySelector<HTMLButtonElement>('#generate')!.addEventListener('click', () => {
    void generateAndRun(promptInput.value);
  });
  document.querySelector<HTMLButtonElement>('#run-json')!.addEventListener('click', () => {
    void runJsonEditor();
  });
  document.querySelector<HTMLButtonElement>('#copy-json')!.addEventListener('click', async () => {
    await navigator.clipboard.writeText(jsonInput.value);
    showToast('JSON copied.');
  });
  document.querySelector<HTMLButtonElement>('#load-example')!.addEventListener('click', async () => {
    const response = await fetch('./ai-game-definition.json');
    const definition = (await response.json()) as GameDefinition;
    jsonInput.value = JSON.stringify(definition, null, 2);
    await runDefinition(definition, 'example');
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-sample]')) {
    button.addEventListener('click', () => {
      const sample = button.dataset.sample as GeneratedKind;
      promptInput.value =
        sample === 'survival'
          ? 'Create a survival arena with falling hazards, lives, timer, spawners, UI health bar and a lose scene.'
          : sample === 'quest'
            ? 'Create a puzzle quest where the player collects a key, opens a door, uses boolean state and reaches a win scene.'
            : 'Create a colorful 3D coin collecting platformer with jumping, score, win scene, lights, UI, prefabs and tweens.';
      void generateAndRun(promptInput.value);
    });
  }
}

async function loadLocalStarter(): Promise<void> {
  const definition = generateGameDefinition(promptInput.value);
  jsonInput.value = JSON.stringify(definition, null, 2);
  await runDefinition(definition, 'local-demo');
  showToast('Starter demo loaded. Use Generate game for Backend AI / OpenAI.');
}

async function generateAndRun(prompt: string): Promise<void> {
  const mode = (document.querySelector<HTMLSelectElement>('#model-mode')!.value || 'backend') as GenerationMode;
  if (mode === 'json') {
    await runJsonEditor();
    return;
  }
  if (mode === 'backend') {
    await generateWithBackend(prompt);
    return;
  }

  setStatus('ready', 'local');
  const definition = generateGameDefinition(prompt);
  jsonInput.value = JSON.stringify(definition, null, 2);
  await runDefinition(definition, classifyPrompt(prompt));
}

async function generateWithBackend(prompt: string): Promise<void> {
  const baseUrl = apiBase();
  try {
    setStatus('ready', 'calling AI');
    showToast('Calling OpenAI through the backend...');

    const response = await fetch(`${baseUrl}/engine/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const payload = (await response.json().catch(() => ({}))) as EngineGenerationResponse;

    if (!response.ok) {
      const message = payload.error || `${response.status} ${response.statusText}`;
      throw new Error(`${message}${payload.code ? ` (${payload.code})` : ''}`);
    }
    if (!payload.gameDefinition) throw new Error('Backend did not return gameDefinition.');

    setStatus('ready', 'validating');
    const definition = parseGameDefinition(payload.gameDefinition);
    jsonInput.value = JSON.stringify(definition, null, 2);

    setStatus('ready', 'running');
    await runDefinition(definition, payload.meta?.model ? `backend:${payload.meta.model}` : 'backend');
    showToast(`Generated with ${payload.meta?.model ?? 'backend AI'} in ${payload.meta?.durationMs ?? 0}ms.`);
  } catch (error) {
    setStatus('error', 'error');
    if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
      showToast(`Backend is unreachable at ${baseUrl}. Start the backend on port 3000 and check /api/health.`);
      return;
    }
    showToast(error instanceof Error ? error.message : String(error));
  }
}

async function runJsonEditor(): Promise<void> {
  try {
    const parsed = JSON.parse(jsonInput.value) as unknown;
    const definition = parseGameDefinition(parsed);
    await runDefinition(definition, 'custom');
  } catch (error) {
    setStatus('error', 'error');
    showToast(error instanceof Error ? error.message : String(error));
  }
}

async function runDefinition(input: unknown, kind: string): Promise<void> {
  const definition = parseGameDefinition(input);
  setStatus('ready', 'running');
  stateUnsubscribe?.();
  sceneUnsubscribe?.();
  engine?.destroy();
  gameRoot.replaceChildren();

  engine = new Engine({
    container: gameRoot,
    background: definition.engine.background ?? '#0b0f16',
    enable3D: definition.engine.enable3D,
    enable2D: definition.engine.enable2D,
    enablePhysics: definition.engine.enablePhysics,
    gravity: definition.engine.gravity,
    fatalOnSystemError: false,
  });
  runtime = new GameRuntime(engine);
  await engine.init();
  await runtime.load(definition);
  engine.start();

  stateUnsubscribe = engine.state.onChange(() => updateMetrics(kind, definition));
  sceneUnsubscribe = engine.events.on('scene:after-switch', () => updateMetrics(kind, definition));
  updateMetrics(kind, definition);
  setStatus('ready', 'ready');
  showToast(`Running: ${definition.metadata.title}`);

  (window as unknown as { engine: Engine; runtime: GameRuntime; gameDefinition: GameDefinition }).engine = engine;
  (window as unknown as { engine: Engine; runtime: GameRuntime; gameDefinition: GameDefinition }).runtime = runtime;
  (window as unknown as { engine: Engine; runtime: GameRuntime; gameDefinition: GameDefinition }).gameDefinition = definition;
}

function apiBase(): string {
  return apiBaseInput.value.trim().replace(/\/$/, '');
}

function updateMetrics(kind: string, definition: GameDefinition): void {
  if (!engine) return;
  metricType.textContent = kind;
  metricScene.textContent = engine.scenes.currentKey() ?? 'none';
  metricState.textContent = JSON.stringify(engine.state.snapshot());
  const systems = definition.scenes.reduce((count, scene) => count + scene.systems.length + scene.behaviors.length + scene.spawners.length, 0);
  metricSystems.textContent = String(systems);
}

function generateGameDefinition(prompt: string): GameDefinition {
  const kind = classifyPrompt(prompt);
  if (kind === 'survival') return survivalGame(prompt);
  if (kind === 'quest') return questGame(prompt);
  return coinGame(prompt);
}

function classifyPrompt(prompt: string): GeneratedKind {
  const text = prompt.toLowerCase();
  if (includesAny(text, ['survival', 'arena', 'hazard', 'meteor', 'enemy', 'dodge', 'zombie', 'הישרדות', 'אויב'])) return 'survival';
  if (includesAny(text, ['quest', 'key', 'door', 'puzzle', 'escape', 'מפתח', 'דלת', 'פאזל'])) return 'quest';
  return 'coin';
}

function coinGame(prompt: string): GameDefinition {
  const palette = paletteFromPrompt(prompt);
  return {
    schemaVersion: 1,
    metadata: {
      title: titleFromPrompt(prompt, 'Coin Jumper'),
      description: 'Prompt-generated collectible platformer using state, behaviors, collisions, prefabs, UI, tweens and image sprites.',
      genre: 'platformer',
    },
    engine: {
      width: 960,
      height: 540,
      enable3D: true,
      enable2D: true,
      enablePhysics: true,
      gravity: { x: 0, y: -12, z: 0 },
      background: palette.background,
    },
    state: {
      score: { type: 'number', initial: 0, min: 0 },
      lives: { type: 'number', initial: 3, min: 0, max: 3 },
    },
    inputBindings: defaultInputBindings(),
    assets: [{ key: 'fenceIcon', type: 'image', url: './assets/starter-packs/oak-woods-sample/Fence.png' }],
    prefabs: {
      coin: {
        tags: ['coin'],
        mesh: { shape: 'cylinder', radiusTop: 0.34, radiusBottom: 0.34, height: 0.1, color: '#facc15', metalness: 0.25 },
        rigidBody: { type: 'static', collider: { shape: 'ball', radius: 0.34 }, colliderOptions: { sensor: true } },
      },
    },
    behaviors: [
      movementBehavior('moveLeft', -4),
      movementBehavior('moveRight', 4),
      { id: 'stop-left', trigger: { type: 'inputReleased', input: 'moveLeft' }, actions: [{ type: 'setVelocityX', target: 'player', value: 0 }] },
      { id: 'stop-right', trigger: { type: 'inputReleased', input: 'moveRight' }, actions: [{ type: 'setVelocityX', target: 'player', value: 0 }] },
      { id: 'jump', trigger: { type: 'inputPressed', input: 'jump' }, actions: [{ type: 'applyImpulse', target: 'player', value: { x: 0, y: 7, z: 0 } }] },
      {
        id: 'collect',
        trigger: { type: 'collision', entityTag: 'player', withTag: 'coin' },
        actions: [
          { type: 'incrementState', stateKey: 'score', amount: 1 },
          { type: 'destroyEntity', target: 'collisionOther' },
        ],
      },
      {
        id: 'win',
        trigger: { type: 'stateChange', stateKey: 'score' },
        conditions: [{ stateKey: 'score', gte: 5 }],
        actions: [{ type: 'switchScene', scene: 'win' }],
      },
    ],
    animations: [{ id: 'player-pulse', target: 'player.scale.y', from: 1, to: 1.08, duration: 0.7, loop: true, yoyo: true, easing: 'easeInOut' }],
    ui: [
      { type: 'text', text: 'Score: {score}', x: 18, y: 18, style: { fontSize: '22px', color: '#ffffff' } },
      { type: 'bar', value: 'lives', max: 3, x: 18, y: 50, width: 150, height: 12, fillColor: '#53c6b8', backgroundColor: '#263241' },
    ],
    scenes: [
      {
        key: 'main',
        background: palette.background,
        lights: standardLights(),
        entities: [
          playerEntity(palette.player),
          groundEntity(palette.ground),
          {
            key: 'fenceBadge',
            sprite: { kind: 'image', assetKey: 'fenceIcon', x: 910, y: 34, width: 36, height: 36, alpha: 0.9, depth: 1001 },
          },
        ],
        spawners: [
          {
            id: 'coin-line',
            prefab: 'coin',
            positions: [
              { x: -4, y: 1.1, z: 0 },
              { x: -2, y: 1.1, z: 0 },
              { x: 0, y: 1.1, z: 0 },
              { x: 2, y: 1.1, z: 0 },
              { x: 4, y: 1.1, z: 0 },
            ],
          },
        ],
      },
      winScene('All coins collected!'),
    ],
    initialScene: 'main',
  };
}

function survivalGame(prompt: string): GameDefinition {
  const palette = paletteFromPrompt(prompt);
  return {
    schemaVersion: 1,
    metadata: {
      title: titleFromPrompt(prompt, 'Hazard Arena'),
      description: 'Prompt-generated survival game using timers, spawners, collision damage, state, UI bars and scene transitions.',
      genre: 'survival',
    },
    engine: { width: 960, height: 540, enable3D: true, enable2D: true, enablePhysics: true, gravity: { x: 0, y: -10, z: 0 }, background: '#141018' },
    state: {
      lives: { type: 'number', initial: 5, min: 0, max: 5 },
      survived: { type: 'number', initial: 0, min: 0 },
    },
    inputBindings: defaultInputBindings(),
    prefabs: {
      hazard: {
        tags: ['hazard'],
        mesh: { shape: 'sphere', radius: 0.38, color: '#ff6b6b', metalness: 0.1 },
        rigidBody: { type: 'dynamic', collider: { shape: 'ball', radius: 0.38 }, linearDamping: 0.02, ccd: true },
      },
    },
    behaviors: [
      movementBehavior('moveLeft', -5),
      movementBehavior('moveRight', 5),
      { id: 'tick-time', trigger: { type: 'timer', every: 1 }, actions: [{ type: 'incrementState', stateKey: 'survived', amount: 1 }] },
      {
        id: 'hurt-player',
        trigger: { type: 'collision', entityTag: 'player', withTag: 'hazard' },
        actions: [
          { type: 'decrementState', stateKey: 'lives', amount: 1 },
          { type: 'destroyEntity', target: 'collisionOther' },
        ],
      },
      {
        id: 'lose',
        trigger: { type: 'stateChange', stateKey: 'lives' },
        conditions: [{ stateKey: 'lives', lte: 0 }],
        actions: [{ type: 'switchScene', scene: 'lose' }],
      },
      {
        id: 'survive-win',
        trigger: { type: 'stateChange', stateKey: 'survived' },
        conditions: [{ stateKey: 'survived', gte: 20 }],
        actions: [{ type: 'switchScene', scene: 'win' }],
      },
    ],
    animations: [{ id: 'player-alert', target: 'player.scale.x', from: 1, to: 1.14, duration: 0.45, loop: true, yoyo: true, easing: 'easeInOut' }],
    ui: [
      { type: 'text', text: 'Survived: {survived}s', x: 18, y: 18, style: { fontSize: '22px', color: '#ffffff' } },
      { type: 'bar', value: 'lives', max: 5, x: 18, y: 50, width: 180, height: 14, fillColor: '#ff6b6b', backgroundColor: '#352834' },
    ],
    scenes: [
      {
        key: 'main',
        background: '#141018',
        lights: standardLights(),
        entities: [playerEntity(palette.player), groundEntity('#30384f')],
        spawners: [{ id: 'falling-hazards', prefab: 'hazard', everySeconds: 1.1, maxAlive: 14, area: { min: { x: -5, y: 8, z: -0.5 }, max: { x: 5, y: 10, z: 0.5 } } }],
      },
      winScene('You survived!'),
      messageScene('lose', 'Game over', '#3a1015'),
    ],
    initialScene: 'main',
  };
}

function questGame(prompt: string): GameDefinition {
  const palette = paletteFromPrompt(prompt);
  return {
    schemaVersion: 1,
    metadata: {
      title: titleFromPrompt(prompt, 'Key Quest'),
      description: 'Prompt-generated puzzle quest using boolean state, conditional door logic, prefabs, UI and scene transitions.',
      genre: 'puzzle quest',
    },
    engine: { width: 960, height: 540, enable3D: true, enable2D: true, enablePhysics: true, gravity: { x: 0, y: -12, z: 0 }, background: '#101820' },
    state: {
      hasKey: { type: 'boolean', initial: false },
      score: { type: 'number', initial: 0, min: 0 },
    },
    inputBindings: defaultInputBindings(),
    prefabs: {},
    behaviors: [
      movementBehavior('moveLeft', -4),
      movementBehavior('moveRight', 4),
      { id: 'jump', trigger: { type: 'inputPressed', input: 'jump' }, actions: [{ type: 'applyImpulse', target: 'player', value: { x: 0, y: 7, z: 0 } }] },
      {
        id: 'collect-key',
        trigger: { type: 'collision', entityTag: 'player', withTag: 'key' },
        actions: [
          { type: 'setState', stateKey: 'hasKey', value: true },
          { type: 'incrementState', stateKey: 'score', amount: 1 },
          { type: 'destroyEntity', target: 'collisionOther' },
        ],
      },
      {
        id: 'open-door',
        trigger: { type: 'collision', entityTag: 'player', withTag: 'door' },
        conditions: [{ stateKey: 'hasKey', equals: true }],
        actions: [{ type: 'switchScene', scene: 'win' }],
      },
    ],
    animations: [
      { id: 'key-spin', target: 'key.rotation.y', from: 0, to: 6.28, duration: 1, loop: true, easing: 'linear' },
      { id: 'door-breathe', target: 'door.scale.y', from: 1, to: 1.12, duration: 0.8, loop: true, yoyo: true, easing: 'easeInOut' },
    ],
    ui: [{ type: 'text', text: 'Has key: {hasKey}', x: 18, y: 18, style: { fontSize: '22px', color: '#ffffff' } }],
    scenes: [
      {
        key: 'main',
        background: '#101820',
        lights: standardLights(),
        entities: [
          playerEntity(palette.player),
          groundEntity(palette.ground),
          {
            key: 'key',
            tags: ['key'],
            transform: { position: { x: -3.5, y: 1.2, z: 0 } },
            mesh: { shape: 'torus', radius: 0.3, tube: 0.08, color: '#f6c65b' },
            rigidBody: { type: 'static', collider: { shape: 'ball', radius: 0.35 }, colliderOptions: { sensor: true } },
          },
          {
            key: 'door',
            tags: ['door'],
            transform: { position: { x: 4.5, y: 1.1, z: 0 }, scale: { x: 1, y: 1.4, z: 1 } },
            mesh: { shape: 'box', size: { x: 0.8, y: 1.6, z: 0.3 }, color: '#53c6b8' },
            rigidBody: { type: 'static', collider: { shape: 'cuboid', halfExtents: { x: 0.45, y: 0.8, z: 0.2 } }, colliderOptions: { sensor: true } },
          },
        ],
      },
      winScene('Door opened!'),
    ],
    initialScene: 'main',
  };
}

function playerEntity(color: string): GameDefinition['scenes'][number]['entities'][number] {
  return {
    key: 'player',
    tags: ['player'],
    transform: { position: { x: 0, y: 2.2, z: 0 } },
    mesh: { shape: 'box', size: { x: 0.8, y: 1.2, z: 0.8 }, color },
    rigidBody: {
      type: 'dynamic',
      collider: { shape: 'cuboid', halfExtents: { x: 0.4, y: 0.6, z: 0.4 } },
      linearDamping: 1.8,
      angularDamping: 2,
      ccd: true,
    },
    cameraTarget: { lerp: 5, offset: { x: 0, y: 4, z: 8 } },
  };
}

function groundEntity(color: string): GameDefinition['scenes'][number]['entities'][number] {
  return {
    key: 'ground',
    tags: ['ground'],
    transform: { position: { x: 0, y: -0.25, z: 0 } },
    mesh: { shape: 'box', size: { x: 12, y: 0.5, z: 4 }, color },
    rigidBody: { type: 'static', collider: { shape: 'cuboid', halfExtents: { x: 6, y: 0.25, z: 2 } } },
  };
}

function movementBehavior(input: string, velocityX: number): GameDefinition['behaviors'][number] {
  return { id: `move-${input}`, trigger: { type: 'inputDown', input }, actions: [{ type: 'setVelocityX', target: 'player', value: velocityX }] };
}

function winScene(message: string): GameDefinition['scenes'][number] {
  return messageScene('win', message, '#052e16');
}

function messageScene(key: string, message: string, background: string): GameDefinition['scenes'][number] {
  return {
    key,
    background,
    entities: [
      {
        key: `${key}-message`,
        sprite: {
          kind: 'text',
          text: message,
          x: 330,
          y: 238,
          style: { fontFamily: 'Arial', fontSize: '48px', color: '#ffffff', stroke: '#000000', strokeThickness: 5 },
        },
      },
    ],
  };
}

function standardLights(): GameDefinition['scenes'][number]['lights'] {
  return [
    { type: 'ambient', color: '#ffffff', intensity: 0.62 },
    { type: 'directional', color: '#ffffff', intensity: 0.92, position: { x: 4, y: 8, z: 5 } },
    { type: 'point', color: '#53c6b8', intensity: 0.8, position: { x: -3, y: 3, z: 2 }, distance: 10 },
  ];
}

function defaultInputBindings(): GameDefinition['inputBindings'] {
  return {
    jump: ['Space', 'ArrowUp', 'KeyW'],
    moveLeft: ['ArrowLeft', 'KeyA'],
    moveRight: ['ArrowRight', 'KeyD'],
  };
}

function paletteFromPrompt(prompt: string): { background: string; player: string; ground: string } {
  const text = prompt.toLowerCase();
  if (includesAny(text, ['forest', 'woods', 'יער'])) return { background: '#0f1f1a', player: '#f6c65b', ground: '#4a7c59' };
  if (includesAny(text, ['space', 'חלל'])) return { background: '#080b1a', player: '#91d7ff', ground: '#353a5a' };
  if (includesAny(text, ['fire', 'lava', 'אש'])) return { background: '#20100f', player: '#ffb86b', ground: '#6f3f2f' };
  return { background: '#111827', player: '#38bdf8', ground: '#4a7c59' };
}

function titleFromPrompt(prompt: string, fallback: string): string {
  const words = prompt
    .replace(/[^a-zA-Z0-9א-ת ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (words.length < 2) return fallback;
  return words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

function includesAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value));
}

function renderCapabilities(): void {
  const chips = [
    ...ENGINE_CAPABILITIES.triggers.slice(0, 5),
    ...ENGINE_CAPABILITIES.actions.slice(0, 6),
    ...ENGINE_CAPABILITIES.meshShapes,
    ...ENGINE_CAPABILITIES.uiTypes.map((item) => `ui:${item}`),
  ];
  capabilitiesEl.replaceChildren(...chips.map((chip) => {
    const el = document.createElement('span');
    el.className = 'chip';
    el.textContent = chip;
    return el;
  }));
}

function setStatus(className: 'ready' | 'error', text: string): void {
  statusEl.className = `status ${className}`;
  statusEl.textContent = text;
}

function showToast(message: string): void {
  toastEl.textContent = message;
}

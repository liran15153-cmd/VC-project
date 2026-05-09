import { Engine, GameRuntime, parseGameDefinition, type GameDefinition } from '../src';

const MESSAGE_IN = 'LOOMIER_PREVIEW_GAME_DEFINITION';
const MESSAGE_OUT = 'LOOMIER_PREVIEW_STATUS';

const gameRoot = document.querySelector<HTMLDivElement>('#game-root')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;

let engine: Engine | null = null;
let runtime: GameRuntime | null = null;

window.addEventListener('message', (event) => {
  const message = event.data as { type?: string; gameDefinition?: unknown } | null;
  if (!message || message.type !== MESSAGE_IN) return;
  void runDefinition(message.gameDefinition);
});

setStatus('ready', 'Preview ready. Waiting for GameDefinition...');
postStatus('ready');

async function runDefinition(input: unknown): Promise<void> {
  try {
    setStatus('running', 'Validating GameDefinition...');
    postStatus('running');

    const definition = parseGameDefinition(input);
    await destroyCurrent();
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

    setStatus('running', `Loading ${definition.assets.length} assets...`);
    await engine.init();
    await runtime.load(definition);
    engine.start();

    exposeRuntime(definition);
    setStatus('ready', `Running: ${definition.metadata.title}`);
    postStatus('ready', { title: definition.metadata.title });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus('error', message);
    postStatus('error', { error: message });
  }
}

async function destroyCurrent(): Promise<void> {
  if (!engine) return;
  engine.destroy();
  engine = null;
  runtime = null;
}

function setStatus(kind: 'ready' | 'running' | 'error', message: string): void {
  statusEl.className = kind === 'running' ? '' : kind;
  statusEl.textContent = message;
}

function postStatus(status: 'ready' | 'running' | 'error', extra: Record<string, unknown> = {}): void {
  window.parent?.postMessage({ type: MESSAGE_OUT, status, ...extra }, '*');
}

function exposeRuntime(definition: GameDefinition): void {
  const target = window as unknown as {
    engine: Engine;
    runtime: GameRuntime;
    gameDefinition: GameDefinition;
  };
  target.engine = engine!;
  target.runtime = runtime!;
  target.gameDefinition = definition;
}

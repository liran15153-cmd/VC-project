import Phaser from 'phaser';
import type { UiDefinition } from '../runtime/GameDefinition';
import type { ISystem, SystemContext } from '../core/types';

type UiObject =
  | { type: 'text'; definition: Extract<UiDefinition, { type: 'text' }>; object: Phaser.GameObjects.Text }
  | {
      type: 'bar';
      definition: Extract<UiDefinition, { type: 'bar' }>;
      background: Phaser.GameObjects.Rectangle;
      fill: Phaser.GameObjects.Rectangle;
    };

export class UISystem implements ISystem {
  readonly name = 'UISystem';
  enabled = true;
  priority = 80;

  private readonly objects: UiObject[] = [];

  constructor(private readonly definitions: UiDefinition[]) {}

  init({ engine }: SystemContext): void {
    if (!engine.phaser?.isReady()) return;
    const scene = engine.phaser.scene;
    for (const definition of this.definitions) {
      if (definition.type === 'text') {
        const object = scene.add.text(definition.x, definition.y, '', definition.style).setDepth(definition.depth).setScrollFactor(0);
        this.objects.push({ type: 'text', definition, object });
      } else {
        const background = scene.add
          .rectangle(definition.x, definition.y, definition.width, definition.height, toPhaserColor(definition.backgroundColor))
          .setOrigin(0, 0)
          .setDepth(definition.depth)
          .setScrollFactor(0);
        const fill = scene.add
          .rectangle(definition.x, definition.y, definition.width, definition.height, toPhaserColor(definition.fillColor))
          .setOrigin(0, 0)
          .setDepth(definition.depth + 1)
          .setScrollFactor(0);
        this.objects.push({ type: 'bar', definition, background, fill });
      }
    }
  }

  update({ engine }: SystemContext): void {
    for (const item of this.objects) {
      if (item.type === 'text') {
        item.object.setText(formatTemplate(item.definition.text, engine.state.snapshot()));
      } else {
        const value = numberFromState(engine, item.definition.value);
        const max = typeof item.definition.max === 'number' ? item.definition.max : numberFromState(engine, item.definition.max);
        const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
        item.fill.width = item.definition.width * ratio;
      }
    }
  }

  destroy(): void {
    for (const item of this.objects) {
      if (item.type === 'text') item.object.destroy();
      else {
        item.background.destroy();
        item.fill.destroy();
      }
    }
    this.objects.length = 0;
  }
}

function formatTemplate(template: string, state: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_match, key: string) => String(state[key] ?? ''));
}

function numberFromState(engine: SystemContext['engine'], key: string): number {
  const value = engine.state.get(key);
  return typeof value === 'number' ? value : 0;
}

function toPhaserColor(color: string | number): number {
  if (typeof color === 'number') return color;
  if (color.startsWith('#')) return Number.parseInt(color.slice(1), 16);
  if (color.startsWith('0x')) return Number.parseInt(color.slice(2), 16);
  return 0xffffff;
}

import type { AudioRule } from '../runtime/GameDefinition';
import type { GameStateChange } from '../core/GameStateStore';
import type { ISystem, SystemContext } from '../core/types';
import type { RuntimeSceneApi } from './RuntimeSceneApi';

export class AudioSystem implements ISystem {
  readonly name = 'AudioSystem';
  enabled = true;
  priority = 90;

  private readonly lastPlayed = new Map<string, number>();
  private unsubscribeState?: () => void;
  private unsubscribeEvent?: () => void;
  private unsubscribeCollision?: () => void;

  constructor(
    private readonly rules: AudioRule[],
    private readonly api: RuntimeSceneApi,
  ) {}

  init({ engine }: SystemContext): void {
    this.unsubscribeState = engine.events.on('state:change', (change) => this.handleStateChange(change));
    this.unsubscribeEvent = engine.events.on('game:event', (event) => this.handleEvent(event.name));
    this.unsubscribeCollision = engine.events.on('game:collision', (collision) => {
      for (const rule of this.rules) {
        const trigger = triggerObject(rule.trigger);
        if (triggerType(rule.trigger) !== 'collision') continue;
        const entityTag = text(trigger.entityTag);
        const withTag = text(trigger.withTag);
        const forward = (!entityTag || collision.tagsA.includes(entityTag)) && (!withTag || collision.tagsB.includes(withTag));
        const reverse = (!entityTag || collision.tagsB.includes(entityTag)) && (!withTag || collision.tagsA.includes(withTag));
        if (forward || reverse) this.play(rule);
      }
    });
  }

  destroy(): void {
    this.unsubscribeState?.();
    this.unsubscribeEvent?.();
    this.unsubscribeCollision?.();
  }

  private handleStateChange(change: GameStateChange): void {
    for (const rule of this.rules) {
      const trigger = triggerObject(rule.trigger);
      if (triggerType(rule.trigger) !== 'stateChange') continue;
      const key = text(trigger.stateKey ?? trigger.key);
      if (key && key !== change.key) continue;
      const direction = text(trigger.direction);
      if (direction === 'increase' && !(typeof change.delta === 'number' && change.delta > 0)) continue;
      if (direction === 'decrease' && !(typeof change.delta === 'number' && change.delta < 0)) continue;
      this.play(rule);
    }
  }

  private handleEvent(name: string): void {
    for (const rule of this.rules) {
      const trigger = triggerObject(rule.trigger);
      if (triggerType(rule.trigger) !== 'event') continue;
      const expected = text(trigger.event ?? trigger.name);
      if (!expected || expected === name) this.play(rule);
    }
  }

  private play(rule: AudioRule): void {
    const key = rule.asset ?? rule.sound;
    if (!key) return;
    const now = performance.now();
    const id = rule.id ?? key;
    const last = this.lastPlayed.get(id) ?? -Infinity;
    if (now - last < rule.cooldownMs) return;
    this.lastPlayed.set(id, now);
    this.api.playAudio(key, rule.volume);
  }
}

function triggerType(trigger: AudioRule['trigger']): string {
  if (typeof trigger === 'string') return trigger;
  return text(trigger.type ?? trigger.trigger) ?? '';
}

function triggerObject(trigger: AudioRule['trigger']): Record<string, unknown> {
  return typeof trigger === 'string' ? { type: trigger } : (trigger as Record<string, unknown>);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

import * as THREE from 'three';
import type { TweenDefinition } from '../runtime/GameDefinition';
import type { EntityId, ISystem, SystemContext } from '../core/types';
import { Transform } from '../components/Transform';
import { findEntityByKey } from './RuntimeSceneApi';

interface RunningTween {
  definition: TweenDefinition;
  entity: EntityId;
  elapsed: number;
  direction: 1 | -1;
  from: number;
  to: number;
}

export class TweenSystem implements ISystem {
  readonly name = 'TweenSystem';
  enabled = true;
  priority = 5;

  private readonly running: RunningTween[] = [];

  constructor(private readonly definitions: TweenDefinition[]) {}

  init(ctx: SystemContext): void {
    for (const definition of this.definitions) {
      if (!definition.trigger || triggerType(definition.trigger) === 'sceneStart') this.startTween(ctx, definition);
    }
  }

  update(ctx: SystemContext): void {
    for (let i = this.running.length - 1; i >= 0; i--) {
      const tween = this.running[i];
      const transform = ctx.world.getComponent(tween.entity, Transform);
      if (!transform) {
        this.running.splice(i, 1);
        continue;
      }

      tween.elapsed += ctx.deltaTime * tween.direction;
      const duration = tween.definition.duration;
      let progress = Math.min(1, Math.max(0, (tween.elapsed - tween.definition.delay) / duration));
      if (tween.definition.delay > 0 && tween.elapsed < tween.definition.delay) progress = 0;
      const eased = ease(progress, tween.definition.easing);
      const value = keyframedValue(tween.definition, eased) ?? lerp(tween.from, tween.to, eased);
      setTransformProperty(transform, tween.definition.property ?? inferProperty(tween.definition.target), value);

      if (progress >= 1 || progress <= 0) {
        if (tween.definition.yoyo) {
          tween.direction *= -1;
          tween.elapsed = tween.direction > 0 ? 0 : duration + tween.definition.delay;
        } else if (tween.definition.loop) {
          tween.elapsed = 0;
        } else {
          this.running.splice(i, 1);
        }
      }
    }
  }

  private startTween(ctx: SystemContext, definition: TweenDefinition): void {
    const entity = findEntityByKey(ctx.world, inferTarget(definition.target));
    if (entity === undefined) return;
    const transform = ctx.world.getComponent(entity, Transform);
    if (!transform) return;

    const property = definition.property ?? inferProperty(definition.target);
    const current = getTransformProperty(transform, property);
    const from = definition.from ?? current;
    const to = definition.to ?? from + (definition.by ?? 0);
    this.running.push({
      definition: { ...definition, property },
      entity,
      elapsed: 0,
      direction: 1,
      from,
      to,
    });
  }
}

function inferTarget(target: string): string {
  const parts = target.split('.');
  if (parts.length >= 3) return parts[0];
  return target;
}

function inferProperty(target: string): string {
  const parts = target.split('.');
  if (parts.length >= 3) return parts.slice(1).join('.');
  return 'position.y';
}

function getTransformProperty(transform: Transform, path: string): number {
  if (path === 'position.x') return transform.position.x;
  if (path === 'position.y') return transform.position.y;
  if (path === 'position.z') return transform.position.z;
  if (path === 'scale.x') return transform.scale.x;
  if (path === 'scale.y') return transform.scale.y;
  if (path === 'scale.z') return transform.scale.z;
  if (path.startsWith('rotation.')) return 0;
  return 0;
}

function setTransformProperty(transform: Transform, path: string, value: number): void {
  if (path === 'position.x') transform.position.x = value;
  else if (path === 'position.y') transform.position.y = value;
  else if (path === 'position.z') transform.position.z = value;
  else if (path === 'scale.x') transform.scale.x = value;
  else if (path === 'scale.y') transform.scale.y = value;
  else if (path === 'scale.z') transform.scale.z = value;
  else if (path === 'rotation.x' || path === 'rotation.y' || path === 'rotation.z') {
    const euler = new THREE.Euler();
    if (path === 'rotation.x') euler.x = value;
    if (path === 'rotation.y') euler.y = value;
    if (path === 'rotation.z') euler.z = value;
    const q = new THREE.Quaternion().setFromEuler(euler);
    transform.rotation = { x: q.x, y: q.y, z: q.z, w: q.w };
  }
}

function keyframedValue(definition: TweenDefinition, progress: number): number | undefined {
  const frames = definition.keyframes;
  if (!frames?.length) return undefined;
  const sorted = [...frames].sort((a, b) => a.t - b.t);
  if (progress <= sorted[0].t) return sorted[0].value;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (progress <= next.t) {
      const local = (progress - prev.t) / Math.max(0.0001, next.t - prev.t);
      return lerp(prev.value, next.value, local);
    }
  }
  return sorted[sorted.length - 1].value;
}

function ease(t: number, easing: TweenDefinition['easing']): number {
  if (easing === 'easeIn') return t * t;
  if (easing === 'easeOut') return 1 - (1 - t) * (1 - t);
  if (easing === 'easeInOut') return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function triggerType(trigger: TweenDefinition['trigger']): string {
  if (!trigger) return 'sceneStart';
  if (typeof trigger === 'string') return trigger;
  return String(trigger.type ?? trigger.trigger ?? '');
}

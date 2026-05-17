import type { BehaviorDefinition } from '../runtime/GameDefinition';
import type { GameStateChange, GameStateValue } from '../core/GameStateStore';
import type { EntityId, ISystem, SystemContext, Vec3 } from '../core/types';
import { EntityInfo } from '../components/EntityInfo';
import { RigidBodyComponent } from '../components/RigidBody';
import { Transform } from '../components/Transform';
import { PhysicsDynamics } from '../physics/PhysicsDynamics';
import type { TriggerVolumePhase, TriggerVolumeRegistry } from '../runtime/TriggerVolumes';
import { emitCollision, entityInfo, entityTags, RuntimeSceneApi, selectEntities, type CollisionContext } from './RuntimeSceneApi';

type TriggerObject = Record<string, unknown>;
type ActionObject = Record<string, unknown>;
type ConditionObject = Record<string, unknown>;

export class BehaviorSystem implements ISystem {
  readonly name = 'BehaviorSystem';
  enabled = true;
  priority = 0;

  private readonly timers = new Map<string, number>();
  private readonly pendingStateChanges: GameStateChange[] = [];
  private readonly pendingGameEvents: Array<{ name: string; payload?: Record<string, unknown> }> = [];
  private unsubscribeState?: () => void;
  private unsubscribeGameEvent?: () => void;
  private sceneStarted = false;

  constructor(
    private readonly behaviors: BehaviorDefinition[],
    private readonly api: RuntimeSceneApi,
    private readonly triggerVolumes?: TriggerVolumeRegistry,
  ) {}

  init({ engine }: SystemContext): void {
    this.unsubscribeState = engine.state.onChange((change) => this.pendingStateChanges.push(change));
    this.unsubscribeGameEvent = engine.events.on('game:event', (event) => this.pendingGameEvents.push(event));
  }

  update(ctx: SystemContext): void {
    if (!this.sceneStarted) {
      this.sceneStarted = true;
      this.runTriggered(ctx, (behavior) => this.triggerType(behavior.trigger) === 'sceneStart');
    }

    this.runInputAndTimerTriggers(ctx);
    this.runCollisionTriggers(ctx);
    this.runStateChangeTriggers(ctx);
    this.runEventTriggers(ctx);
  }

  destroy(): void {
    this.unsubscribeState?.();
    this.unsubscribeGameEvent?.();
    this.pendingStateChanges.length = 0;
    this.pendingGameEvents.length = 0;
  }

  private runInputAndTimerTriggers(ctx: SystemContext): void {
    this.runTriggered(ctx, (behavior, index) => {
      const trigger = this.triggerObject(behavior.trigger);
      const type = this.triggerType(behavior.trigger);
      if (type === 'inputPressed' || type === 'keyDown') {
        const input = text(trigger.input ?? trigger.key);
        return !!input && (trigger.input ? ctx.engine.input.actionPressed(input) : ctx.engine.input.pressed(input));
      }
      if (type === 'inputDown') {
        const input = text(trigger.input ?? trigger.key);
        return !!input && (trigger.input ? ctx.engine.input.actionDown(input) : ctx.engine.input.down(input));
      }
      if (type === 'inputReleased' || type === 'keyUp') {
        const input = text(trigger.input ?? trigger.key);
        return !!input && (trigger.input ? ctx.engine.input.actionReleased(input) : ctx.engine.input.released(input));
      }
      if (type !== 'timer') return false;

      const every = number(trigger.every ?? trigger.everySeconds ?? trigger.seconds);
      if (!every) return false;
      const id = text(trigger.id) ?? behavior.id ?? `timer:${index}`;
      const previous = this.timers.get(id) ?? 0;
      const next = previous + ctx.deltaTime;
      if (next < every) {
        this.timers.set(id, next);
        return false;
      }
      this.timers.set(id, next - every);
      return true;
    });
  }

  private runCollisionTriggers(ctx: SystemContext): void {
    if (!ctx.engine.physics?.isReady()) return;

    ctx.engine.physics.drainPhysicsEvents((event) => {
      const base: CollisionContext = {
        entityA: event.entityA,
        entityB: event.entityB,
        started: event.type === 'collisionEnter' || event.type === 'sensorEnter',
      };
      emitCollision(ctx.engine, ctx.world, base);

      this.runTriggered(ctx, (behavior) => {
        if (this.triggerType(behavior.trigger) !== 'collision') return false;
        const trigger = this.triggerObject(behavior.trigger);
        const oriented = orientCollision(ctx.world, base, text(trigger.entityTag), text(trigger.withTag));
        if (!oriented) return false;
        this.runBehavior(ctx, behavior, oriented);
        return false;
      });

      this.runTriggerVolumeActions(ctx, event.entityA, event.entityB, event.type);
      this.runTriggerVolumeActions(ctx, event.entityB, event.entityA, event.type);
    });
  }

  private runTriggerVolumeActions(
    ctx: SystemContext,
    triggerEntity: EntityId,
    otherEntity: EntityId,
    eventType: string,
  ): void {
    if (!this.triggerVolumes?.has(triggerEntity)) return;
    const phase = phaseForEventType(eventType);
    if (!phase) return;
    const actions = this.triggerVolumes.getActions(triggerEntity, phase);
    if (!actions || !actions.length) return;
    const collision: CollisionContext = {
      entityA: triggerEntity,
      entityB: otherEntity,
      started: phase === 'onEnter',
      self: triggerEntity,
      other: otherEntity,
    };
    for (const action of actions) this.runAction(ctx, action as ActionObject, collision);
  }

  private runStateChangeTriggers(ctx: SystemContext): void {
    while (this.pendingStateChanges.length) {
      const change = this.pendingStateChanges.shift()!;
      this.runTriggered(ctx, (behavior) => {
        if (this.triggerType(behavior.trigger) !== 'stateChange') return false;
        const trigger = this.triggerObject(behavior.trigger);
        const key = text(trigger.stateKey ?? trigger.key);
        return !key || key === change.key;
      });
    }
  }

  private runEventTriggers(ctx: SystemContext): void {
    while (this.pendingGameEvents.length) {
      const event = this.pendingGameEvents.shift()!;
      this.runTriggered(ctx, (behavior) => {
        if (this.triggerType(behavior.trigger) !== 'event') return false;
        const trigger = this.triggerObject(behavior.trigger);
        const name = text(trigger.event ?? trigger.name);
        return !name || name === event.name;
      });
    }
  }

  private runTriggered(ctx: SystemContext, predicate: (behavior: BehaviorDefinition, index: number) => boolean): void {
    for (let i = 0; i < this.behaviors.length; i++) {
      const behavior = this.behaviors[i];
      if (predicate(behavior, i)) this.runBehavior(ctx, behavior);
    }
  }

  private runBehavior(ctx: SystemContext, behavior: BehaviorDefinition, collision?: CollisionContext): void {
    if (!this.conditionsPass(ctx, behavior.conditions as ConditionObject[], collision)) return;
    const actions = behavior.actions.length ? behavior.actions : [behavior as unknown as ActionObject];
    for (const action of actions as ActionObject[]) this.runAction(ctx, action, collision);
  }

  private conditionsPass(ctx: SystemContext, conditions: ConditionObject[], collision?: CollisionContext): boolean {
    for (const condition of conditions) {
      const key = text(condition.stateKey ?? condition.key);
      if (key) {
        const value = ctx.engine.state.get(key);
        if (!compareStateValue(value, condition)) return false;
      }
      const tag = text(condition.tag);
      if (tag) {
        const target = condition.target ?? 'self';
        const ids = selectEntities(ctx.world, target, collision);
        if (!ids.some((id) => entityInfo(ctx.world, id)?.hasTag(tag))) return false;
      }
    }
    return true;
  }

  private runAction(ctx: SystemContext, action: ActionObject, collision?: CollisionContext): void {
    const type = text(action.type ?? action.action);
    if (!type) return;

    if (type === 'setState') {
      const key = text(action.stateKey ?? action.key);
      const value = stateValue(action.value);
      if (key && value !== undefined) ctx.engine.state.set(key, value);
      return;
    }
    if (type === 'incrementState' || type === 'decrementState') {
      const key = text(action.stateKey ?? action.key);
      if (!key) return;
      const amount = number(action.amount) ?? 1;
      if (type === 'incrementState') ctx.engine.state.increment(key, amount);
      else ctx.engine.state.decrement(key, amount);
      return;
    }
    if (type === 'switchScene') {
      const scene = text(action.scene ?? action.target);
      if (scene) void ctx.engine.scenes.switchTo(scene);
      return;
    }
    if (type === 'spawnPrefab') {
      const prefab = text(action.prefab);
      if (prefab) this.api.spawnPrefab(prefab, { position: vec3(action.position ?? action.value), tags: arrayOfText(action.tags) });
      return;
    }
    if (type === 'playSound') {
      const asset = text(action.asset ?? action.sound);
      if (asset) this.api.playAudio(asset, number(action.volume) ?? 1);
      return;
    }
    if (type === 'emitEvent') {
      const event = text(action.event ?? action.name);
      if (event) this.api.emitGameEvent(event, objectPayload(action.payload));
      return;
    }

    const targets = selectEntities(ctx.world, action.target ?? 'self', collision);
    for (const id of targets) {
      if (type === 'destroyEntity') this.api.destroyEntity(id);
      else if (type === 'applyImpulse') this.applyImpulse(ctx, id, vec3(action.value));
      else if (type === 'applyForce') this.applyForce(ctx, id, vec3(action.value));
      else if (type === 'applyTorque') this.applyTorque(ctx, id, vec3(action.value));
      else if (type === 'setVelocity' || type === 'setLinearVelocity') this.setVelocity(ctx, id, vec3(action.value));
      else if (type === 'setVelocityX') this.setVelocityAxis(ctx, id, 'x', number(action.value ?? action.amount) ?? 0);
      else if (type === 'setVelocityY') this.setVelocityAxis(ctx, id, 'y', number(action.value ?? action.amount) ?? 0);
      else if (type === 'setVelocityZ') this.setVelocityAxis(ctx, id, 'z', number(action.value ?? action.amount) ?? 0);
      else if (type === 'setAngularVelocity') this.setAngularVelocity(ctx, id, vec3(action.value));
      else if (type === 'addKnockback') this.addKnockback(ctx, id, vec3(action.value ?? action.direction), action);
      else if (type === 'setPosition') this.setPosition(ctx, id, vec3(action.value ?? action.position));
      else if (type === 'translate') this.translate(ctx, id, vec3(action.value));
      else if (type === 'addTag') this.addTag(ctx, id, text(action.tag ?? action.value));
      else if (type === 'removeTag') this.removeTag(ctx, id, text(action.tag ?? action.value));
    }
  }

  private applyImpulse(ctx: SystemContext, id: EntityId, value?: Vec3): void {
    if (!value) return;
    if (ctx.engine.physics?.isReady()) PhysicsDynamics.applyImpulse(ctx.engine.physics, id, value);
  }

  private applyForce(ctx: SystemContext, id: EntityId, value?: Vec3): void {
    if (!value) return;
    if (ctx.engine.physics?.isReady()) PhysicsDynamics.applyForce(ctx.engine.physics, id, value);
  }

  private applyTorque(ctx: SystemContext, id: EntityId, value?: Vec3): void {
    if (!value) return;
    if (ctx.engine.physics?.isReady()) PhysicsDynamics.applyTorque(ctx.engine.physics, id, value);
  }

  private setVelocity(ctx: SystemContext, id: EntityId, value?: Vec3): void {
    if (!value) return;
    if (ctx.engine.physics?.isReady()) PhysicsDynamics.setLinearVelocity(ctx.engine.physics, id, value);
  }

  private setVelocityAxis(ctx: SystemContext, id: EntityId, axis: 'x' | 'y' | 'z', value: number): void {
    if (ctx.engine.physics?.isReady()) PhysicsDynamics.setLinearVelocityAxis(ctx.engine.physics, id, axis, value);
  }

  private setAngularVelocity(ctx: SystemContext, id: EntityId, value?: Vec3): void {
    if (!value) return;
    if (ctx.engine.physics?.isReady()) PhysicsDynamics.setAngularVelocity(ctx.engine.physics, id, value);
  }

  private addKnockback(ctx: SystemContext, id: EntityId, direction: Vec3 | undefined, action: ActionObject): void {
    if (!direction) return;
    if (!ctx.engine.physics?.isReady()) return;
    PhysicsDynamics.addKnockback(ctx.engine.physics, id, direction, {
      power: number(action.power) ?? number(action.amount) ?? 1,
      upwardBias: number(action.upwardBias) ?? 0,
      clearVelocity: action.clearVelocity === true,
    });
  }

  private setPosition(ctx: SystemContext, id: EntityId, value?: Vec3): void {
    if (!value) return;
    const transform = ctx.world.getComponent(id, Transform);
    if (transform) transform.position = { ...value };
    const body = ctx.world.getComponent(id, RigidBodyComponent)?.body;
    body?.setTranslation(value, true);
  }

  private translate(ctx: SystemContext, id: EntityId, value?: Vec3): void {
    if (!value) return;
    const transform = ctx.world.getComponent(id, Transform);
    if (!transform) return;
    this.setPosition(ctx, id, {
      x: transform.position.x + value.x,
      y: transform.position.y + value.y,
      z: transform.position.z + value.z,
    });
  }

  private addTag(ctx: SystemContext, id: EntityId, tag?: string): void {
    if (tag) ctx.world.getComponent(id, EntityInfo)?.tags.add(tag);
  }

  private removeTag(ctx: SystemContext, id: EntityId, tag?: string): void {
    if (tag) ctx.world.getComponent(id, EntityInfo)?.tags.delete(tag);
  }

  private triggerType(trigger: BehaviorDefinition['trigger']): string {
    if (typeof trigger === 'string') return trigger;
    return text(trigger.type ?? trigger.trigger) ?? '';
  }

  private triggerObject(trigger: BehaviorDefinition['trigger']): TriggerObject {
    return typeof trigger === 'string' ? { type: trigger } : (trigger as TriggerObject);
  }
}

function phaseForEventType(eventType: string): TriggerVolumePhase | null {
  if (eventType === 'sensorEnter' || eventType === 'collisionEnter') return 'onEnter';
  if (eventType === 'sensorExit' || eventType === 'collisionExit') return 'onExit';
  if (eventType === 'collisionStay') return 'onStay';
  return null;
}

function orientCollision(world: SystemContext['world'], context: CollisionContext, entityTag?: string, withTag?: string): CollisionContext | null {
  const aTags = entityTags(world, context.entityA);
  const bTags = entityTags(world, context.entityB);
  const aMatches = !entityTag || aTags.includes(entityTag);
  const bMatches = !withTag || bTags.includes(withTag);
  if (aMatches && bMatches) return { ...context, self: context.entityA, other: context.entityB };
  const reverseMatches = (!entityTag || bTags.includes(entityTag)) && (!withTag || aTags.includes(withTag));
  if (reverseMatches) return { ...context, self: context.entityB, other: context.entityA };
  return null;
}

function compareStateValue(value: GameStateValue | undefined, condition: ConditionObject): boolean {
  if ('equals' in condition && value !== condition.equals) return false;
  if ('notEquals' in condition && value === condition.notEquals) return false;
  if (typeof value === 'number') {
    if (number(condition.gt) !== undefined && !(value > number(condition.gt)!)) return false;
    if (number(condition.gte) !== undefined && !(value >= number(condition.gte)!)) return false;
    if (number(condition.lt) !== undefined && !(value < number(condition.lt)!)) return false;
    if (number(condition.lte) !== undefined && !(value <= number(condition.lte)!)) return false;
  }
  return true;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stateValue(value: unknown): GameStateValue | undefined {
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  return undefined;
}

function vec3(value: unknown): Vec3 | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const x = number(source.x);
  const y = number(source.y);
  const z = number(source.z);
  return x !== undefined && y !== undefined && z !== undefined ? { x, y, z } : undefined;
}

function arrayOfText(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function objectPayload(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

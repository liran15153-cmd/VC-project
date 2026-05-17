import type { EntityId } from '../core/types';

/** A trigger action is the same shape as a behavior action — opaque to this module. */
export type TriggerActionDefinition = Record<string, unknown>;

export interface TriggerVolumeDefinition {
  onEnter?: ReadonlyArray<TriggerActionDefinition>;
  onExit?: ReadonlyArray<TriggerActionDefinition>;
  onStay?: ReadonlyArray<TriggerActionDefinition>;
}

export type TriggerVolumePhase = 'onEnter' | 'onExit' | 'onStay';

/**
 * Declarative trigger registry. The `entity.trigger` field on a GameDefinition entity
 * becomes one entry here — the BehaviorSystem looks it up on physics enter/exit/stay
 * events and executes the configured actions without requiring a separate behavior rule.
 */
export class TriggerVolumeRegistry {
  private readonly entries = new Map<EntityId, TriggerVolumeDefinition>();

  register(entityId: EntityId, definition: TriggerVolumeDefinition): void {
    this.entries.set(entityId, definition);
  }

  unregister(entityId: EntityId): void {
    this.entries.delete(entityId);
  }

  get(entityId: EntityId): TriggerVolumeDefinition | undefined {
    return this.entries.get(entityId);
  }

  getActions(entityId: EntityId, phase: TriggerVolumePhase): ReadonlyArray<TriggerActionDefinition> | undefined {
    return this.entries.get(entityId)?.[phase];
  }

  has(entityId: EntityId): boolean {
    return this.entries.has(entityId);
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }
}

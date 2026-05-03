import type { Component, ComponentClass, ComponentsOf, EntityId } from './types';

/**
 * ECS World - stores entities and their components in column-style maps
 * for fast iteration and component lookup.
 */
export class World {
  private nextId: EntityId = 1;
  private alive = new Set<EntityId>();

  // Map<componentType, Map<entityId, component>>
  private stores = new Map<string, Map<EntityId, Component>>();

  createEntity(): EntityId {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    if (!this.alive.delete(id)) return;
    for (const store of this.stores.values()) store.delete(id);
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  addComponent<T extends Component>(id: EntityId, component: T): T {
    if (!this.alive.has(id)) throw new Error(`Cannot add "${component.type}" to missing entity ${id}.`);
    let store = this.stores.get(component.type);
    if (!store) {
      store = new Map();
      this.stores.set(component.type, store);
    }
    store.set(id, component);
    return component;
  }

  removeComponent(id: EntityId, type: string): void {
    this.stores.get(type)?.delete(id);
  }

  getComponent<T extends Component>(id: EntityId, ctor: ComponentClass<T>): T | undefined {
    return this.stores.get(ctor.type)?.get(id) as T | undefined;
  }

  hasComponent(id: EntityId, type: string): boolean {
    return this.stores.get(type)?.has(id) ?? false;
  }

  /** Iterate all entities that own every requested component type. */
  *query<const T extends readonly ComponentClass[]>(
    ...ctors: T
  ): IterableIterator<{ id: EntityId; components: ComponentsOf<T> }> {
    if (ctors.length === 0) return;
    const stores = ctors.map((c) => this.stores.get(c.type));
    if (stores.some((s) => !s)) return;

    // pick smallest store as the driver to minimise iterations
    let smallest = stores[0]!;
    for (const s of stores) if (s!.size < smallest.size) smallest = s!;

    outer: for (const id of smallest.keys()) {
      const components: Component[] = [];
      for (const s of stores) {
        const c = s!.get(id);
        if (!c) continue outer;
        components.push(c);
      }
      yield { id, components: components as ComponentsOf<T> };
    }
  }

  entityCount(): number {
    return this.alive.size;
  }

  clear(): void {
    this.alive.clear();
    this.stores.clear();
    this.nextId = 1;
  }
}

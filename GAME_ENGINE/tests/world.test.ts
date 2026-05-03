import { describe, expect, it } from 'vitest';
import { World } from '../src/core/World';
import { Transform } from '../src/components/Transform';
import { CameraTarget } from '../src/components/CameraTarget';

describe('World', () => {
  it('queries entities that contain every requested component', () => {
    const world = new World();
    const tracked = world.createEntity();
    const transform = world.addComponent(tracked, new Transform({ position: { x: 1, y: 2, z: 3 } }));
    const cameraTarget = world.addComponent(tracked, new CameraTarget());

    const unrelated = world.createEntity();
    world.addComponent(unrelated, new Transform());

    const results = [...world.query(Transform, CameraTarget)];

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(tracked);
    expect(results[0].components[0]).toBe(transform);
    expect(results[0].components[1]).toBe(cameraTarget);
  });

  it('rejects components added to missing entities', () => {
    const world = new World();
    expect(() => world.addComponent(999, new Transform())).toThrow(/missing entity/i);
  });

  it('removes all components when an entity is destroyed', () => {
    const world = new World();
    const entity = world.createEntity();
    world.addComponent(entity, new Transform());
    world.destroyEntity(entity);

    expect(world.isAlive(entity)).toBe(false);
    expect([...world.query(Transform)]).toHaveLength(0);
  });
});

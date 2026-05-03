import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus';

interface TestEvents {
  ping: { value: number };
}

describe('EventBus', () => {
  it('emits typed events and unsubscribes cleanly', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.on('ping', handler);

    bus.emit('ping', { value: 7 });
    unsubscribe();
    bus.emit('ping', { value: 8 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 7 });
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('supports once handlers', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.once('ping', handler);

    bus.emit('ping', { value: 1 });
    bus.emit('ping', { value: 2 });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

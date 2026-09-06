import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from './event-emitter';

describe('EventEmitter', () => {
  it('registers and emits events with arguments', () => {
    const emitter = new EventEmitter<{ test: [msg: string, code: number] }>();
    const handler = vi.fn();

    emitter.on('test', handler);
    emitter.emit('test', 'hello', 42);

    expect(handler).toHaveBeenCalledWith('hello', 42);
  });

  it('unsubscribes using the returned cleanup function', () => {
    const emitter = new EventEmitter<{ test: [string] }>();
    const handler = vi.fn();

    const unsubscribe = emitter.on('test', handler);
    emitter.emit('test', 'first');
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitter.emit('test', 'second');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removes all listeners', () => {
    const emitter = new EventEmitter<{ a: []; b: [] }>();
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    emitter.on('a', handlerA);
    emitter.on('b', handlerB);
    emitter.removeAllListeners();

    emitter.emit('a');
    emitter.emit('b');

    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).not.toHaveBeenCalled();
  });
});

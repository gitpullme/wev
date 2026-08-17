// kernel/bridge/EventBus.ts
// Global typed event emitter for cross-mini-app communication.
// Mini-apps never touch this directly — they go through wev.bridge.emit/on.
// The bridge namespaces events so Sports emitting 'booking:created'
// actually emits 'sports:booking:created'.

type EventHandler = (payload: unknown) => void;

class EventBusImpl {
  private listeners = new Map<string, Set<EventHandler>>();

  /**
   * Emit an event to all registered listeners.
   * @param channel - Full namespaced event name (e.g., 'sports:booking:created')
   * @param payload - Arbitrary payload data
   */
  emit(channel: string, payload: unknown): void {
    const handlers = this.listeners.get(channel);
    if (!handlers) return;

    // Iterate a copy to avoid issues if a handler unsubscribes during emission
    for (const handler of Array.from(handlers)) {
      try {
        handler(payload);
      } catch (err) {
        // A handler crash must not kill other handlers or the emitter.
        // Log and continue.
        console.error(`[EventBus] Handler error on "${channel}":`, err);
      }
    }
  }

  /**
   * Register a listener for a specific event channel.
   * @returns Unsubscribe function
   */
  on(channel: string, handler: EventHandler): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(handler);

    // Return cleanup function
    return () => {
      const handlers = this.listeners.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.listeners.delete(channel);
        }
      }
    };
  }

  /**
   * Remove a specific handler from a channel.
   */
  off(channel: string, handler: EventHandler): void {
    const handlers = this.listeners.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(channel);
      }
    }
  }

  /**
   * Remove all listeners. Used during testing or app teardown.
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners on a channel. Useful for debugging.
   */
  listenerCount(channel: string): number {
    return this.listeners.get(channel)?.size ?? 0;
  }
}

// Singleton — one bus for the entire app.
export const EventBus = new EventBusImpl();

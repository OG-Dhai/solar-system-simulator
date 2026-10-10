/**
 * Decoupled EventBus for sparse, asynchronous events.
 * Keeps the ECS hot paths clean of immediate callbacks.
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event 
   * @param {Function} callback 
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit an event immediately.
   * @param {string} event 
   * @param {any} payload 
   */
  emit(event, payload) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    for (let i = 0; i < callbacks.length; i++) {
      callbacks[i](payload);
    }
  }
}

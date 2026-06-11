class EventBus {
  constructor() {
    this._handlers = new Map();
    this._onceHandlers = new Map();
  }

  On(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event).add(handler);
    return () => this.Off(event, handler);
  }

  Once(event, handler) {
    if (!this._onceHandlers.has(event)) {
      this._onceHandlers.set(event, new Set());
    }
    this._onceHandlers.get(event).add(handler);
    return () => this.Off(event, handler);
  }

  async Emit(event, payload) {
    const handlers = this._handlers.get(event) || new Set();
    const onceHandlers = this._onceHandlers.get(event) || new Set();

    for (const handler of handlers) {
      await handler(payload);
    }

    for (const handler of onceHandlers) {
      await handler(payload);
    }

    if (onceHandlers.size > 0) {
      this._onceHandlers.delete(event);
    }
  }

  Off(event, handler) {
    const handlers = this._handlers.get(event);
    if (handlers) handlers.delete(handler);

    const onceHandlers = this._onceHandlers.get(event);
    if (onceHandlers) onceHandlers.delete(handler);

    return this;
  }

  clear(event) {
    if (event) {
      this._handlers.delete(event);
      this._onceHandlers.delete(event);
    } else {
      this._handlers.clear();
      this._onceHandlers.clear();
    }
    return this;
  }
}

module.exports = EventBus;

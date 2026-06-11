class LifecycleHooks {
  constructor() {
    this._hooks = {
      booting: [],
      booted: [],
      stopping: [],
      stopped: [],
      reloading: [],
      reloaded: [],
    };
  }

  on(event, handler) {
    if (!this._hooks[event]) {
      throw new Error(`[lifecycle] Unbekanntes Event: ${event}`);
    }
    this._hooks[event].push(handler);
    return this;
  }

  async emit(event, payload) {
    const handlers = this._hooks[event] || [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

module.exports = LifecycleHooks;

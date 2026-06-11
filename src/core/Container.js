class Container {
  constructor() {
    this._bindings = new Map();
    this._singletons = new Map();
  }

  Register(name, factory, options = {}) {
    const key = this._normalize(name);
    this._bindings.set(key, {
      factory,
      lifetime: options.lifetime || 'transient',
    });
    return this;
  }

  Singleton(name, factory) {
    return this.Register(name, factory, { lifetime: 'singleton' });
  }

  Transient(name, factory) {
    return this.Register(name, factory, { lifetime: 'transient' });
  }

  Resolve(name) {
    const key = this._normalize(name);
    const binding = this._bindings.get(key);

    if (!binding) {
      throw new Error(`[container] Service "${name}" ist nicht registriert.`);
    }

    if (binding.lifetime === 'singleton') {
      if (!this._singletons.has(key)) {
        this._singletons.set(key, this._invokeFactory(binding.factory));
      }
      return this._singletons.get(key);
    }

    return this._invokeFactory(binding.factory);
  }

  TryResolve(name) {
    try {
      return this.Resolve(name);
    } catch {
      return null;
    }
  }

  Remove(name) {
    const key = this._normalize(name);
    this._bindings.delete(key);
    this._singletons.delete(key);
    return this;
  }

  Has(name) {
    return this._bindings.has(this._normalize(name));
  }

  _normalize(name) {
    if (typeof name === 'function') return name.name;
    return String(name);
  }

  _invokeFactory(factory) {
    if (typeof factory === 'function') {
      return factory(this);
    }
    return factory;
  }

  registerModuleServices(services = {}, client) {
    for (const [name, ServiceClass] of Object.entries(services)) {
      if (typeof ServiceClass === 'function') {
        this.Singleton(name, () => new ServiceClass(client, this));
      } else {
        this.Singleton(name, () => ServiceClass);
      }
    }
  }
}

module.exports = Container;

class MiddlewarePipeline {
  constructor() {
    this._stack = [];
  }

  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('[middleware] Handler muss eine Funktion sein.');
    }
    this._stack.push(middleware);
    return this;
  }

  clear() {
    this._stack = [];
    return this;
  }

  async run(ctx, finalHandler) {
    let index = 0;

    const next = async () => {
      if (index >= this._stack.length) {
        if (typeof finalHandler === 'function') {
          return finalHandler();
        }
        return undefined;
      }

      const middleware = this._stack[index];
      index += 1;
      return middleware(ctx, next);
    };

    return next();
  }
}

module.exports = MiddlewarePipeline;

// shared/container/Container.js
const { createContainer, asClass, asFunction, asValue } = require('awilix');

class DIContainer {
  constructor() {
    this.container = createContainer();
    this.setupContainer();
  }

  setupContainer() {
    // Core services
    this.container.register({
      // Config
      config: asValue(require('../../config')),
      
      // Utils
      logger: asFunction(() => ({
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.log
      })).singleton(),
    });
  }

  get(name) {
    return this.container.resolve(name);
  }

  register(name, resolver) {
    this.container.register({ [name]: resolver });
  }

  getContainer() {
    return this.container;
  }
}

module.exports = new DIContainer();
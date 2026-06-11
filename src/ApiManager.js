const fs = require('fs');
const path = require('path');
const express = require('express');

class ApiManager {
  constructor(client, projectRoot, config) {
    this.client = client;
    this.projectRoot = projectRoot;
    this.config = config;
    this.app = express();
    this.server = null;
    this.routesPath = path.join(projectRoot, 'src', 'api');
    this._routes = [];
  }

  _clearCache(filePath) {
    const resolved = require.resolve(filePath);
    delete require.cache[resolved];
  }

  _getRouteFiles() {
    if (!fs.existsSync(this.routesPath)) {
      fs.mkdirSync(this.routesPath, { recursive: true });
      return [];
    }

    return fs
      .readdirSync(this.routesPath)
      .filter((file) => file.endsWith('.js') && file !== 'server.js');
  }

  loadRoutes() {
    this._routes = [];
    const files = this._getRouteFiles();

    for (const file of files) {
      const filePath = path.join(this.routesPath, file);
      this._clearCache(filePath);
      const route = require(filePath);

      if (!route.method || !route.path || typeof route.execute !== 'function') {
        console.warn(`[api] Überspringe ${file}: method, path oder execute fehlt.`);
        continue;
      }

      route._filePath = filePath;
      route._fileName = file;
      this._routes.push(route);
      console.log(`[api] Route geladen: ${route.method.toUpperCase()} ${route.path}`);
    }

    return this._routes;
  }

  _registerRoute(route) {
    const method = route.method.toLowerCase();

    if (typeof this.app[method] !== 'function') {
      console.warn(`[api] Ungültige HTTP-Methode: ${route.method}`);
      return;
    }

    this.app[method](route.path, async (req, res) => {
      try {
        await route.execute(req, res, this.client);
      } catch (error) {
        console.error(`[api] Fehler in ${route.method} ${route.path}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Interner Serverfehler' });
        }
      }
    });
  }

  async start() {
    if (!this.config.api?.enabled) {
      console.log('[api] Deaktiviert in der Konfiguration.');
      return null;
    }

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        bot: this.config.bot?.name,
        uptime: process.uptime(),
        discord: {
          ready: this.client.isReady(),
          user: this.client.user?.tag || null,
        },
      });
    });

    this.loadRoutes();
    for (const route of this._routes) {
      this._registerRoute(route);
    }

    const port = this.config.api.port || 3000;

    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`[api] Server läuft auf Port ${port}`);
        resolve(this.server);
      });
    });
  }

  async stop() {
    if (!this.server) return;

    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) reject(error);
        else {
          console.log('[api] Server gestoppt.');
          this.server = null;
          resolve();
        }
      });
    });
  }

  reloadRoutes() {
    this.loadRoutes();
    return this._routes;
  }

  async restart() {
    if (!this.config.api?.enabled) return null;

    const wasRunning = Boolean(this.server);
    if (wasRunning) {
      await this.stop();
    }

    this.app = express();
    return this.start();
  }
}

module.exports = ApiManager;

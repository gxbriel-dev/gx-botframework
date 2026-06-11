const mysql = require('mysql2/promise');

const TABLE_NAME = 'bot_kv_store';

class MysqlDatabase {
  constructor() {
    this._pool = null;
    this._connected = false;
  }

  _getPoolConfig() {
    return {
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'bot_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  }

  async _ensureTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
        \`key\` VARCHAR(255) NOT NULL PRIMARY KEY,
        \`value\` JSON NOT NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    await this._pool.execute(sql);
  }

  async connect() {
    this._pool = mysql.createPool(this._getPoolConfig());
    await this._pool.query('SELECT 1');
    await this._ensureTable();
    this._connected = true;
    console.log('[db] MySQL-Datenbank verbunden.');
  }

  async disconnect() {
    if (this._pool) {
      await this._pool.end();
      this._pool = null;
      this._connected = false;
      console.log('[db] MySQL-Datenbank getrennt.');
    }
  }

  async get(key) {
    const [rows] = await this._pool.execute(
      `SELECT \`value\` FROM \`${TABLE_NAME}\` WHERE \`key\` = ? LIMIT 1`,
      [key]
    );

    if (rows.length === 0) return null;

    const raw = rows[0].value;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async set(key, value) {
    const serialized = JSON.stringify(value);

    await this._pool.execute(
      `INSERT INTO \`${TABLE_NAME}\` (\`key\`, \`value\`)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
      [key, serialized]
    );

    return value;
  }

  async delete(key) {
    const [result] = await this._pool.execute(
      `DELETE FROM \`${TABLE_NAME}\` WHERE \`key\` = ?`,
      [key]
    );

    return result.affectedRows > 0;
  }

  async has(key) {
    const [rows] = await this._pool.execute(
      `SELECT 1 FROM \`${TABLE_NAME}\` WHERE \`key\` = ? LIMIT 1`,
      [key]
    );

    return rows.length > 0;
  }

  async all() {
    const [rows] = await this._pool.execute(
      `SELECT \`key\`, \`value\` FROM \`${TABLE_NAME}\``
    );

    const result = {};

    for (const row of rows) {
      result[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    }

    return result;
  }

  async clear() {
    await this._pool.execute(`TRUNCATE TABLE \`${TABLE_NAME}\``);
  }
}

module.exports = new MysqlDatabase();

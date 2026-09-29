const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "price_detector.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT,
    target_price REAL NOT NULL,
    current_price REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    price REAL NOT NULL,
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
  CREATE INDEX IF NOT EXISTS idx_history_product ON price_history(product_id);
`);

module.exports = db;

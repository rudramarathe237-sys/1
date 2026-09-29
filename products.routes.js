const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function serializeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    targetPrice: row.target_price,
    currentPrice: row.current_price,
    isAtOrBelowTarget: row.current_price <= row.target_price,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getOwnedProduct(id, userId) {
  return db
    .prepare("SELECT * FROM products WHERE id = ? AND user_id = ?")
    .get(id, userId);
}

// GET /api/products - list all tracked products for the logged-in user
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM products WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json({ products: rows.map(serializeProduct) });
});

// POST /api/products - start tracking a new product
router.post("/", (req, res) => {
  const { name, url, targetPrice, currentPrice } = req.body || {};

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Product name is required" });
  }
  if (typeof targetPrice !== "number" || targetPrice < 0) {
    return res.status(400).json({ error: "targetPrice must be a non-negative number" });
  }
  if (typeof currentPrice !== "number" || currentPrice < 0) {
    return res.status(400).json({ error: "currentPrice must be a non-negative number" });
  }

  const result = db
    .prepare(
      `INSERT INTO products (user_id, name, url, target_price, current_price)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(req.user.id, name, url || null, targetPrice, currentPrice);

  db.prepare("INSERT INTO price_history (product_id, price) VALUES (?, ?)").run(
    result.lastInsertRowid,
    currentPrice
  );

  const row = getOwnedProduct(result.lastInsertRowid, req.user.id);
  res.status(201).json({ product: serializeProduct(row) });
});

// GET /api/products/:id - get one product with full price history
router.get("/:id", (req, res) => {
  const row = getOwnedProduct(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Product not found" });

  const history = db
    .prepare(
      "SELECT id, price, checked_at FROM price_history WHERE product_id = ? ORDER BY checked_at ASC"
    )
    .all(row.id);

  res.json({ product: serializeProduct(row), history });
});

// PUT /api/products/:id - update name, url, or target price
router.put("/:id", (req, res) => {
  const row = getOwnedProduct(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Product not found" });

  const { name, url, targetPrice } = req.body || {};
  const nextName = name !== undefined ? name : row.name;
  const nextUrl = url !== undefined ? url : row.url;
  const nextTarget = targetPrice !== undefined ? targetPrice : row.target_price;

  if (typeof nextTarget !== "number" || nextTarget < 0) {
    return res.status(400).json({ error: "targetPrice must be a non-negative number" });
  }

  db.prepare(
    `UPDATE products
     SET name = ?, url = ?, target_price = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(nextName, nextUrl, nextTarget, row.id, req.user.id);

  const updated = getOwnedProduct(row.id, req.user.id);
  res.json({ product: serializeProduct(updated) });
});

// DELETE /api/products/:id - stop tracking a product
router.delete("/:id", (req, res) => {
  const row = getOwnedProduct(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Product not found" });

  db.prepare("DELETE FROM products WHERE id = ? AND user_id = ?").run(row.id, req.user.id);
  res.status(204).send();
});

// POST /api/products/:id/prices - log a new price check for a product
router.post("/:id/prices", (req, res) => {
  const row = getOwnedProduct(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Product not found" });

  const { price } = req.body || {};
  if (typeof price !== "number" || price < 0) {
    return res.status(400).json({ error: "price must be a non-negative number" });
  }

  db.prepare("INSERT INTO price_history (product_id, price) VALUES (?, ?)").run(row.id, price);
  db.prepare(
    "UPDATE products SET current_price = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(price, row.id);

  const updated = getOwnedProduct(row.id, req.user.id);
  res.status(201).json({
    product: serializeProduct(updated),
    droppedToTarget: price <= updated.target_price,
  });
});

// GET /api/products/:id/prices - list price history for a product
router.get("/:id/prices", (req, res) => {
  const row = getOwnedProduct(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Product not found" });

  const history = db
    .prepare(
      "SELECT id, price, checked_at FROM price_history WHERE product_id = ? ORDER BY checked_at ASC"
    )
    .all(row.id);

  res.json({ history });
});

module.exports = router;

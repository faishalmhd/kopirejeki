'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { generateProductId, generateOrderId } = require('./validate');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'kopi-rejeki.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    kategori TEXT NOT NULL,
    harga INTEGER NOT NULL,
    stok INTEGER NOT NULL,
    deskripsi TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '☕',
    unggulan INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    product_name TEXT NOT NULL,
    kategori TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    total INTEGER NOT NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'baru',
    stock_applied INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_products_kategori ON products(kategori);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
`);

const DEFAULT_SETTINGS = {
  store_name: 'Toko Kopi Rejeki',
  store_tagline: 'UMKM Roastery & Kedai Lokal',
  whatsapp_number: '6281234567890',
  store_address: 'Jl. Contoh No. 1, Malang, Jawa Timur',
  store_hours: 'Setiap hari, 08.00 – 21.00 WIB',
};

const INITIAL_PRODUCTS = [
  {
    id: 'kopi-01',
    nama: 'Arabika Ijen Natural 250g',
    kategori: 'Biji Kopi',
    harga: 78000,
    stok: 18,
    deskripsi:
      'Biji kopi single-origin lereng Gunung Ijen dengan proses pascapanen natural, menghadirkan aroma beri merah, karamel, dan keasaman segar seimbang.',
    imageUrl: '🫘',
    unggulan: true,
  },
  {
    id: 'kopi-02',
    nama: 'Robusta Dampit Sangrai Gelap 250g',
    kategori: 'Biji Kopi',
    harga: 52000,
    stok: 25,
    deskripsi:
      'Biji Robusta pilihan asal Dampit dengan profil dark roast berkarakter tebal, sentuhan cokelat hitam pekat, dan crema melimpah.',
    imageUrl: '🫘',
    unggulan: false,
  },
  {
    id: 'kopi-03',
    nama: 'Kopi Tubruk Klasik Rejeki 200g',
    kategori: 'Kopi Bubuk',
    harga: 32000,
    stok: 40,
    deskripsi:
      'Racikan bubuk kopi giling halus warisan keluarga dengan aroma harum khas kedai kopi tradisional, mantap diseduh air mendidih.',
    imageUrl: '☕',
    unggulan: true,
  },
  {
    id: 'kopi-04',
    nama: 'House Blend Espresso Rejeki 250g',
    kategori: 'Kopi Bubuk',
    harga: 65000,
    stok: 14,
    deskripsi:
      'Perpaduan 70% Arabika dan 30% Robusta giling medium-fine yang dirancang untuk moka pot, mesin espresso, maupun racikan kopi susu.',
    imageUrl: '☕',
    unggulan: false,
  },
  {
    id: 'kopi-05',
    nama: 'Es Kopi Susu Gula Aren 250ml',
    kategori: 'Siap Saji',
    harga: 20000,
    stok: 30,
    deskripsi:
      'Perpaduan espresso house blend segar, susu UHT full cream creamy, dan sirup gula aren organik asli dalam botol praktis siap minum.',
    imageUrl: '🧊',
    unggulan: true,
  },
  {
    id: 'kopi-06',
    nama: 'Cold Brew Black Citrus 250ml',
    kategori: 'Siap Saji',
    harga: 22000,
    stok: 0,
    deskripsi:
      'Kopi seduh dingin selama 16 jam dengan sentuhan ekstrak kulit jeruk segar. Rendah asam, menyegarkan, dan tanpa tambahan gula.',
    imageUrl: '🧊',
    unggulan: false,
  },
  {
    id: 'kopi-07',
    nama: 'Paket Hampers Ngopi Pagi',
    kategori: 'Bundling',
    harga: 135000,
    stok: 10,
    deskripsi:
      'Kotak kado eksklusif berisi 1 Arabika Ijen 250g, 1 Kopi Tubruk Klasik 200g, gelas enamel estetik, dan kartu ucapan personal.',
    imageUrl: '🎁',
    unggulan: true,
  },
  {
    id: 'kopi-08',
    nama: 'Paket Drip Bag Nusantara (10 Sachet)',
    kategori: 'Bundling',
    harga: 85000,
    stok: 15,
    deskripsi:
      '10 sachet kopi drip praktis tinggal seduh berisi varian Arabika nusantara pilihan, cocok menemani kerja di kantor maupun perjalanan.',
    imageUrl: '🎁',
    unggulan: false,
  },
];

function rowToProduct(row) {
  return {
    id: row.id,
    nama: row.nama,
    kategori: row.kategori,
    harga: row.harga,
    stok: row.stok,
    deskripsi: row.deskripsi,
    imageUrl: row.image_url,
    unggulan: Boolean(row.unggulan),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listProducts() {
  const rows = db.prepare('SELECT * FROM products ORDER BY unggulan DESC, rowid ASC').all();
  return rows.map(rowToProduct);
}

function getProduct(id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return row ? rowToProduct(row) : null;
}

function createProduct(data) {
  const now = new Date().toISOString();
  const id = data.id || generateProductId();
  db.prepare(
    `INSERT INTO products (id, nama, kategori, harga, stok, deskripsi, image_url, unggulan, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.nama,
    data.kategori,
    data.harga,
    data.stok,
    data.deskripsi || '',
    data.imageUrl || '☕',
    data.unggulan ? 1 : 0,
    now,
    now
  );
  return getProduct(id);
}

function updateProduct(id, data) {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE products
       SET nama = ?, kategori = ?, harga = ?, stok = ?, deskripsi = ?, image_url = ?, unggulan = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      data.nama,
      data.kategori,
      data.harga,
      data.stok,
      data.deskripsi || '',
      data.imageUrl || '☕',
      data.unggulan ? 1 : 0,
      now,
      id
    );
  if (result.changes === 0) return null;
  return getProduct(id);
}

function deleteProduct(id) {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return result.changes > 0;
}

function replaceAllProducts(products) {
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM products');
    const insert = db.prepare(
      `INSERT INTO products (id, nama, kategori, harga, stok, deskripsi, image_url, unggulan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of products) {
      insert.run(
        p.id || generateProductId(),
        p.nama,
        p.kategori,
        p.harga,
        p.stok,
        p.deskripsi || '',
        p.imageUrl || '☕',
        p.unggulan ? 1 : 0,
        now,
        now
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function rowToOrder(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    kategori: row.kategori,
    qty: row.qty,
    unitPrice: row.unit_price,
    total: row.total,
    customerName: row.customer_name,
    note: row.note,
    status: row.status,
    stockApplied: Boolean(row.stock_applied),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function listOrders(options = {}) {
  const limitRaw = Number(options.limit);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 200;
  const status = options.status;

  const rows =
    status && status !== 'semua'
      ? db
          .prepare(
            'SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC, rowid DESC LIMIT ?'
          )
          .all(status, limit)
      : db
          .prepare('SELECT * FROM orders ORDER BY created_at DESC, rowid DESC LIMIT ?')
          .all(limit);

  return rows.map(rowToOrder);
}

function getOrder(id) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return row ? rowToOrder(row) : null;
}

function createOrder(data) {
  const product = getProduct(data.productId);
  if (!product) {
    return { ok: false, code: 'NOT_FOUND', error: 'Produk tidak ditemukan.' };
  }
  if (data.qty > product.stok) {
    return {
      ok: false,
      code: 'OUT_OF_STOCK',
      error: 'Stok tidak mencukupi. Tersedia ' + product.stok + ' unit.',
    };
  }

  const now = new Date().toISOString();
  const id = generateOrderId();
  const total = product.harga * data.qty;

  db.prepare(
    `INSERT INTO orders (
       id, product_id, product_name, kategori, qty, unit_price, total,
       customer_name, note, status, stock_applied, created_at, updated_at, completed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'baru', 0, ?, ?, NULL)`
  ).run(
    id,
    product.id,
    product.nama,
    product.kategori,
    data.qty,
    product.harga,
    total,
    data.customerName || '',
    data.note || '',
    now,
    now
  );

  return { ok: true, order: getOrder(id) };
}

function updateOrderStatus(id, nextStatus) {
  const order = getOrder(id);
  if (!order) {
    return { ok: false, code: 'NOT_FOUND', error: 'Pesanan tidak ditemukan.' };
  }
  if (order.status === nextStatus) {
    return { ok: true, order };
  }

  const now = new Date().toISOString();
  let stockApplied = order.stockApplied;

  db.exec('BEGIN');
  try {
    if (nextStatus === 'selesai' && !stockApplied) {
      const product = getProduct(order.productId);
      if (product) {
        if (product.stok < order.qty) {
          db.exec('ROLLBACK');
          return {
            ok: false,
            code: 'INSUFFICIENT_STOCK',
            error:
              'Stok "' + product.nama + '" tidak mencukupi (tersisa ' + product.stok + ' unit).',
          };
        }
        db.prepare('UPDATE products SET stok = stok - ?, updated_at = ? WHERE id = ?').run(
          order.qty,
          now,
          product.id
        );
        stockApplied = true;
      }
    } else if (nextStatus !== 'selesai' && stockApplied) {
      const product = getProduct(order.productId);
      if (product) {
        db.prepare('UPDATE products SET stok = stok + ?, updated_at = ? WHERE id = ?').run(
          order.qty,
          now,
          product.id
        );
      }
      stockApplied = false;
    }

    const completedAt = nextStatus === 'selesai' ? order.completedAt || now : null;
    db.prepare(
      `UPDATE orders
       SET status = ?, stock_applied = ?, updated_at = ?, completed_at = ?
       WHERE id = ?`
    ).run(nextStatus, stockApplied ? 1 : 0, now, completedAt, id);

    db.exec('COMMIT');
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw error;
  }

  return { ok: true, order: getOrder(id) };
}

function getSalesSummary() {
  const rows = db.prepare("SELECT * FROM orders WHERE status = 'selesai'").all();
  const now = new Date();
  const isSameDay = (value) => {
    const date = new Date(value);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  };
  const isSameMonth = (value) => {
    const date = new Date(value);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  };

  let revenue = 0;
  let todayRevenue = 0;
  let monthRevenue = 0;
  let itemsSold = 0;
  const productTotals = new Map();

  for (const row of rows) {
    revenue += row.total;
    itemsSold += row.qty;
    if (row.completed_at && isSameDay(row.completed_at)) todayRevenue += row.total;
    if (row.completed_at && isSameMonth(row.completed_at)) monthRevenue += row.total;

    const key = row.product_id || row.product_name;
    const current = productTotals.get(key) || {
      productId: row.product_id,
      productName: row.product_name,
      qty: 0,
      revenue: 0,
    };
    current.qty += row.qty;
    current.revenue += row.total;
    productTotals.set(key, current);
  }

  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(CASE WHEN status = 'baru' THEN 1 ELSE 0 END) AS pending_orders,
         SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS completed_orders,
         SUM(CASE WHEN status = 'dibatalkan' THEN 1 ELSE 0 END) AS cancelled_orders
       FROM orders`
    )
    .get();

  const completedOrders = counts.completed_orders || 0;

  return {
    totalOrders: counts.total_orders || 0,
    pendingOrders: counts.pending_orders || 0,
    completedOrders,
    cancelledOrders: counts.cancelled_orders || 0,
    revenue,
    itemsSold,
    averageOrderValue: completedOrders > 0 ? Math.round(revenue / completedOrders) : 0,
    todayRevenue,
    monthRevenue,
    topProducts: [...productTotals.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
  };
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = {};
  for (const row of rows) stored[row.key] = row.value;
  return { ...DEFAULT_SETTINGS, ...stored };
}

function updateSettings(settings) {
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  db.exec('BEGIN');
  try {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, String(value ?? ''));
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getSettings();
}

function countUsers() {
  return db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
}

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
}

function createUser(username, passwordHash) {
  db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(
    username,
    passwordHash,
    new Date().toISOString()
  );
}

function updateUserPassword(username, passwordHash) {
  const result = db
    .prepare('UPDATE users SET password_hash = ? WHERE username = ?')
    .run(passwordHash, username);
  return result.changes > 0;
}

function seedIfEmpty() {
  const totalProduct = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;
  if (totalProduct === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO products (id, nama, kategori, harga, stok, deskripsi, image_url, unggulan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    db.exec('BEGIN');
    try {
      for (const p of INITIAL_PRODUCTS) {
        insert.run(
          p.id,
          p.nama,
          p.kategori,
          p.harga,
          p.stok,
          p.deskripsi,
          p.imageUrl,
          p.unggulan ? 1 : 0,
          now,
          now
        );
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  const totalSettings = db.prepare('SELECT COUNT(*) AS total FROM settings').get().total;
  if (totalSettings === 0) {
    updateSettings(DEFAULT_SETTINGS);
  }
}

module.exports = {
  db,
  DB_PATH,
  DEFAULT_SETTINGS,
  INITIAL_PRODUCTS,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  replaceAllProducts,
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  getSalesSummary,
  getSettings,
  updateSettings,
  countUsers,
  findUserByUsername,
  createUser,
  updateUserPassword,
  seedIfEmpty,
};

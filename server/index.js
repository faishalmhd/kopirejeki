import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { initDatabase, queryAll, queryOne, runSql } from './db.js';
import {
  attachOptionalUser,
  COOKIE_NAME,
  requireAuth,
  requireRole,
  signUserToken,
} from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../public/uploads');
const DIST_DIR = path.resolve(__dirname, '../dist');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const VALID_CATEGORIES = ['Biji Kopi', 'Kopi Bubuk', 'Siap Saji', 'Bundling'];
const VALID_STATUSES = ['Menunggu Konfirmasi', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'];

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(attachOptionalUser);

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function sanitizeProductInput(body) {
  const errors = [];
  const nama = typeof body.nama === 'string' ? body.nama.trim() : '';
  if (!nama) errors.push('Nama produk wajib diisi.');
  if (nama.length > 120) errors.push('Nama produk maksimal 120 karakter.');

  const kategori = typeof body.kategori === 'string' ? body.kategori.trim() : '';
  if (!VALID_CATEGORIES.includes(kategori)) {
    errors.push(`Kategori harus salah satu dari: ${VALID_CATEGORIES.join(', ')}.`);
  }

  const harga = Number(body.harga);
  if (!Number.isFinite(harga) || harga < 0) {
    errors.push('Harga harus berupa angka >= 0.');
  }

  const stok = Number(body.stok);
  if (!Number.isFinite(stok) || !Number.isInteger(stok) || stok < 0) {
    errors.push('Stok harus bilangan bulat >= 0.');
  }

  const deskripsi = typeof body.deskripsi === 'string' ? body.deskripsi.trim().slice(0, 600) : '';
  const imageUrl =
    typeof body.imageUrl === 'string' && body.imageUrl.trim()
      ? body.imageUrl.trim()
      : './images/products/arabika-ijen.jpg';

  const lowerImg = imageUrl.toLowerCase();
  if (lowerImg.startsWith('javascript:') || lowerImg.startsWith('vbscript:')) {
    errors.push('URL gambar tidak aman.');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      nama,
      kategori,
      harga: Math.round(harga),
      stok,
      deskripsi,
      imageUrl,
      unggulan: body.unggulan ? 1 : 0,
    },
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'production-sqlite', timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role, shopName, whatsapp, address } = req.body || {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanRole = role === 'seller' ? 'seller' : 'pembeli';

  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Format email tidak valid.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });
  }
  if (cleanRole === 'seller' && (!shopName || String(shopName).trim().length < 3)) {
    return res.status(400).json({ error: 'Nama Toko / UMKM wajib diisi minimal 3 karakter untuk akun Seller.' });
  }

  const existing = queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (existing) {
    return res.status(409).json({ error: 'Email sudah terdaftar. Silakan masuk menggunakan akun tersebut.' });
  }

  const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const createdAt = new Date().toISOString();

  runSql(
    `INSERT INTO users (id, name, email, password_hash, role, shop_name, whatsapp, address, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      cleanName,
      cleanEmail,
      passwordHash,
      cleanRole,
      cleanRole === 'seller' ? String(shopName).trim() : '',
      typeof whatsapp === 'string' ? whatsapp.replace(/[^\d]/g, '') : '',
      typeof address === 'string' ? address.trim() : '',
      createdAt,
    ]
  );

  const user = queryOne(
    'SELECT id, name, email, role, shop_name, whatsapp, address, is_active, created_at FROM users WHERE id = ?',
    [id]
  );
  const token = signUserToken(user);
  setSessionCookie(res, token);

  return res.status(201).json({ user, token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanEmail || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
  }

  const userRecord = queryOne('SELECT * FROM users WHERE email = ?', [cleanEmail]);
  if (!userRecord || !bcrypt.compareSync(password, userRecord.password_hash)) {
    return res.status(401).json({ error: 'Email atau kata sandi salah.' });
  }

  if (!userRecord.is_active) {
    return res.status(403).json({ error: 'Akun Anda dinonaktifkan oleh Administrator.' });
  }

  const { password_hash: _ignored, ...safeUser } = userRecord;
  const token = signUserToken(safeUser);
  setSessionCookie(res, token);

  return res.json({ user: safeUser, token });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user || null });
});

app.post('/api/upload', requireRole('seller', 'admin'), (req, res) => {
  const { filename, dataUrl } = req.body || {};
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Format gambar tidak valid.' });
  }

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) {
    return res.status(400).json({ error: 'Hanya mendukung format PNG, JPG, atau WEBP.' });
  }

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 3 * 1024 * 1024) {
    return res.status(400).json({ error: 'Ukuran gambar maksimal 3 MB.' });
  }

  const safeBase = String(filename || 'produk')
    .replace(/[^a-z0-9-_]/gi, '')
    .slice(0, 24) || 'produk';
  const storedName = `${safeBase}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);

  return res.json({ imageUrl: `/uploads/${storedName}` });
});

app.get('/api/products', (req, res) => {
  const { query = '', kategori = 'Semua', sort = 'default', sellerId = '' } = req.query;

  let sql = `
    SELECT
      p.*,
      u.name AS seller_name,
      u.shop_name AS shop_name,
      u.whatsapp AS seller_whatsapp,
      COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.product_id = p.id), 0) AS avg_rating,
      COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id), 0) AS review_count
    FROM products p
    JOIN users u ON u.id = p.seller_id
    WHERE 1=1
  `;
  const params = [];

  if (kategori && kategori !== 'Semua') {
    sql += ' AND p.kategori = ?';
    params.push(String(kategori));
  }
  if (sellerId) {
    sql += ' AND p.seller_id = ?';
    params.push(String(sellerId));
  }
  if (query && String(query).trim()) {
    sql += ' AND (LOWER(p.nama) LIKE ? OR LOWER(p.deskripsi) LIKE ? OR LOWER(u.shop_name) LIKE ?)';
    const q = `%${String(query).trim().toLowerCase()}%`;
    params.push(q, q, q);
  }

  if (sort === 'termurah') sql += ' ORDER BY p.harga ASC';
  else if (sort === 'termahal') sql += ' ORDER BY p.harga DESC';
  else if (sort === 'nama-asc') sql += ' ORDER BY p.nama ASC';
  else if (sort === 'rating') sql += ' ORDER BY avg_rating DESC, p.unggulan DESC';
  else sql += ' ORDER BY p.unggulan DESC, p.created_at DESC';

  const products = queryAll(sql, params).map((row) => ({
    ...row,
    imageUrl: row.image_url,
    unggulan: Boolean(row.unggulan),
  }));

  res.json({ products });
});

app.get('/api/products/:id', (req, res) => {
  const product = queryOne(
    `SELECT
      p.*,
      u.name AS seller_name,
      u.shop_name AS shop_name,
      u.whatsapp AS seller_whatsapp,
      COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.product_id = p.id), 0) AS avg_rating,
      COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id), 0) AS review_count
    FROM products p
    JOIN users u ON u.id = p.seller_id
    WHERE p.id = ?`,
    [req.params.id]
  );

  if (!product) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  const reviews = queryAll(
    'SELECT id, buyer_name, rating, comment, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC',
    [req.params.id]
  );

  res.json({
    product: { ...product, imageUrl: product.image_url, unggulan: Boolean(product.unggulan) },
    reviews,
  });
});

app.post('/api/products', requireRole('seller', 'admin'), (req, res) => {
  const check = sanitizeProductInput(req.body || {});
  if (!check.valid) {
    return res.status(400).json({ error: check.errors[0], errors: check.errors });
  }

  const sellerId =
    req.user.role === 'admin' && req.body.sellerId ? String(req.body.sellerId) : req.user.id;
  const id = `kopi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = new Date().toISOString();

  runSql(
    `INSERT INTO products (id, seller_id, nama, kategori, harga, stok, deskripsi, image_url, unggulan, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sellerId,
      check.data.nama,
      check.data.kategori,
      check.data.harga,
      check.data.stok,
      check.data.deskripsi,
      check.data.imageUrl,
      check.data.unggulan,
      createdAt,
    ]
  );

  const created = queryOne('SELECT * FROM products WHERE id = ?', [id]);
  return res.status(201).json({
    product: { ...created, imageUrl: created.image_url, unggulan: Boolean(created.unggulan) },
  });
});

app.put('/api/products/:id', requireRole('seller', 'admin'), (req, res) => {
  const existing = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  if (req.user.role !== 'admin' && existing.seller_id !== req.user.id) {
    return res.status(403).json({ error: 'Anda hanya dapat mengubah produk milik toko Anda sendiri.' });
  }

  const check = sanitizeProductInput(req.body || {});
  if (!check.valid) {
    return res.status(400).json({ error: check.errors[0], errors: check.errors });
  }

  runSql(
    `UPDATE products
     SET nama = ?, kategori = ?, harga = ?, stok = ?, deskripsi = ?, image_url = ?, unggulan = ?
     WHERE id = ?`,
    [
      check.data.nama,
      check.data.kategori,
      check.data.harga,
      check.data.stok,
      check.data.deskripsi,
      check.data.imageUrl,
      check.data.unggulan,
      req.params.id,
    ]
  );

  const updated = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
  return res.json({
    product: { ...updated, imageUrl: updated.image_url, unggulan: Boolean(updated.unggulan) },
  });
});

app.delete('/api/products/:id', requireRole('seller', 'admin'), (req, res) => {
  const existing = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  if (req.user.role !== 'admin' && existing.seller_id !== req.user.id) {
    return res.status(403).json({ error: 'Anda hanya dapat menghapus produk milik toko Anda sendiri.' });
  }

  runSql('DELETE FROM products WHERE id = ?', [req.params.id]);
  return res.json({ ok: true });
});

app.post('/api/products/:id/reviews', requireRole('pembeli', 'admin'), (req, res) => {
  const product = queryOne('SELECT id FROM products WHERE id = ?', [req.params.id]);
  if (!product) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  const rating = Number(req.body?.rating);
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating harus antara 1 sampai 5 bintang.' });
  }
  if (comment.length < 3 || comment.length > 400) {
    return res.status(400).json({ error: 'Ulasan minimal 3 karakter dan maksimal 400 karakter.' });
  }

  const id = `rev-${Date.now().toString(36)}`;
  runSql(
    `INSERT INTO reviews (id, product_id, buyer_id, buyer_name, rating, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, req.params.id, req.user.id, req.user.name, rating, comment, new Date().toISOString()]
  );

  return res.status(201).json({ ok: true });
});

app.post('/api/orders', requireRole('pembeli', 'admin'), (req, res) => {
  const { items, shippingMethod, shippingAddress, notes } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Keranjang belanja masih kosong.' });
  }

  const cleanAddress = typeof shippingAddress === 'string' ? shippingAddress.trim() : '';
  if (cleanAddress.length < 5) {
    return res.status(400).json({ error: 'Alamat pengiriman atau catatan pengambilan wajib diisi.' });
  }

  const method = typeof shippingMethod === 'string' && shippingMethod.trim()
    ? shippingMethod.trim()
    : 'Kurir Lokal Banyuwangi';
  const shippingCost = method === 'Ambil di Kedai' ? 0 : method === 'Ekspedisi Reguler' ? 18000 : 10000;

  let subtotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Jumlah pembelian tidak valid.' });
    }
    const dbProduct = queryOne('SELECT * FROM products WHERE id = ?', [item.productId]);
    if (!dbProduct) {
      return res.status(404).json({ error: 'Salah satu produk di keranjang tidak ditemukan.' });
    }
    if (dbProduct.stok < qty) {
      return res.status(400).json({
        error: `Stok "${dbProduct.nama}" tidak mencukupi (tersisa ${dbProduct.stok}).`,
      });
    }
    subtotal += dbProduct.harga * qty;
    validatedItems.push({ dbProduct, qty });
  }

  const orderId = `ORD-${Date.now().toString().slice(-8)}`;
  const totalAmount = subtotal + shippingCost;
  const createdAt = new Date().toISOString();

  runSql(
    `INSERT INTO orders (id, buyer_id, buyer_name, shipping_method, shipping_address, notes, subtotal, shipping_cost, total_amount, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu Konfirmasi', ?)`,
    [
      orderId,
      req.user.id,
      req.user.name,
      method,
      cleanAddress,
      typeof notes === 'string' ? notes.trim().slice(0, 300) : '',
      subtotal,
      shippingCost,
      totalAmount,
      createdAt,
    ]
  );

  for (const entry of validatedItems) {
    const itemId = `oi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    runSql(
      `INSERT INTO order_items (id, order_id, product_id, seller_id, product_name, price, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        orderId,
        entry.dbProduct.id,
        entry.dbProduct.seller_id,
        entry.dbProduct.nama,
        entry.dbProduct.harga,
        entry.qty,
      ]
    );

    runSql('UPDATE products SET stok = stok - ? WHERE id = ?', [entry.qty, entry.dbProduct.id]);
  }

  return res.status(201).json({ ok: true, orderId, totalAmount });
});

app.get('/api/orders', requireAuth, (req, res) => {
  let orders = [];
  if (req.user.role === 'admin') {
    orders = queryAll('SELECT * FROM orders ORDER BY created_at DESC');
  } else if (req.user.role === 'seller') {
    orders = queryAll(
      `SELECT DISTINCT o.*
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE oi.seller_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
  } else {
    orders = queryAll('SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC', [req.user.id]);
  }

  const enriched = orders.map((o) => {
    const items =
      req.user.role === 'seller'
        ? queryAll('SELECT * FROM order_items WHERE order_id = ? AND seller_id = ?', [o.id, req.user.id])
        : queryAll('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    return { ...o, items };
  });

  res.json({ orders: enriched });
});

app.patch('/api/orders/:id/status', requireRole('seller', 'admin'), (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status pesanan tidak valid.' });
  }

  const order = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  }

  if (req.user.role === 'seller') {
    const ownsItem = queryOne(
      'SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?',
      [req.params.id, req.user.id]
    );
    if (!ownsItem) {
      return res.status(403).json({ error: 'Pesanan ini bukan milik toko Anda.' });
    }
  }

  runSql('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  return res.json({ ok: true });
});

app.get('/api/admin/users', requireRole('admin'), (_req, res) => {
  const users = queryAll(
    'SELECT id, name, email, role, shop_name, whatsapp, address, is_active, created_at FROM users ORDER BY created_at ASC'
  );
  res.json({ users });
});

app.patch('/api/admin/users/:id', requireRole('admin'), (req, res) => {
  const target = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }

  const nextRole = ['admin', 'seller', 'pembeli'].includes(req.body?.role) ? req.body.role : target.role;
  const nextActive = typeof req.body?.is_active === 'boolean' ? (req.body.is_active ? 1 : 0) : target.is_active;

  if (target.id === req.user.id && (!nextActive || nextRole !== 'admin')) {
    return res.status(400).json({ error: 'Tidak dapat menonaktifkan atau menurunkan peran akun Admin yang sedang aktif.' });
  }

  runSql('UPDATE users SET role = ?, is_active = ? WHERE id = ?', [nextRole, nextActive, req.params.id]);
  return res.json({ ok: true });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server Toko Kopi Rejeki berjalan di http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Gagal menginisialisasi database:', err);
    process.exit(1);
  });

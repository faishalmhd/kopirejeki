'use strict';

require('dotenv').config();

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const dbModule = require('./src/db');
const {
  validateProduct,
  validateSettings,
  validateOrderInput,
  validateOrderStatus,
  normalizeWhatsAppNumber,
  ORDER_STATUSES,
  VALID_CATEGORIES,
  EMOJI_OPTIONS,
} = require('./src/validate');
const {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
  requireAuth,
} = require('./src/auth');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_SECRET = process.env.SESSION_SECRET || '';

if (SESSION_SECRET.length < 32) {
  console.error(
    '\n[SALAH KONFIGURASI] SESSION_SECRET di file .env wajib diisi minimal 32 karakter.\n' +
      'Salin .env.example menjadi .env lalu ganti SESSION_SECRET dengan string acak panjang.\n'
  );
  process.exit(1);
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};

// Hindari upgrade paksa ke HTTPS saat pengembangan lokal lewat http://localhost.
if (!IS_PRODUCTION) {
  cspDirectives.upgradeInsecureRequests = null;
}

app.use(
  helmet({
    contentSecurityPolicy: { directives: cspDirectives },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { ok: false, error: 'Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi.' },
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Terlalu banyak pesanan dalam waktu singkat. Coba lagi sebentar.' },
});

app.use('/api', apiLimiter);

function sameOriginOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  const origin = req.headers.origin;
  if (!origin) return next();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || req.headers.host;
  try {
    if (new URL(origin).host !== host) {
      return res.status(403).json({ ok: false, error: 'Permintaan lintas situs ditolak.' });
    }
  } catch {
    return res.status(403).json({ ok: false, error: 'Origin permintaan tidak valid.' });
  }
  next();
}

app.use('/api', sameOriginOnly);

/* ------------------------------------------------------------------ */
/* Autentikasi                                                         */
/* ------------------------------------------------------------------ */

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password || username.length > 64 || password.length > 200) {
    return res.status(400).json({ ok: false, error: 'Username dan password wajib diisi.' });
  }

  const user = dbModule.findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Username atau password salah.' });
  }

  setSessionCookie(req, res, createSessionToken(user));
  return res.json({ ok: true, user: { username: user.username } });
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.json({ ok: true, authenticated: false, user: null });
  return res.json({ ok: true, authenticated: true, user: { username: user.username } });
});

/* ------------------------------------------------------------------ */
/* Produk                                                              */
/* ------------------------------------------------------------------ */

app.get('/api/products', (req, res) => {
  res.json({ ok: true, products: dbModule.listProducts() });
});

app.get('/api/products/export', requireAuth, (req, res) => {
  const products = dbModule.listProducts().map((p) => ({
    id: p.id,
    nama: p.nama,
    kategori: p.kategori,
    harga: p.harga,
    stok: p.stok,
    deskripsi: p.deskripsi,
    imageUrl: p.imageUrl,
    unggulan: p.unggulan,
  }));
  const filename = 'toko-kopi-rejeki-' + new Date().toISOString().slice(0, 10) + '.json';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.send(JSON.stringify(products, null, 2));
});

app.post('/api/products/import', requireAuth, (req, res) => {
  const raw = req.body;
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.products) ? raw.products : null;

  if (!list || list.length === 0) {
    return res
      .status(400)
      .json({ ok: false, error: 'Body harus berupa array produk yang tidak kosong.' });
  }
  if (list.length > 500) {
    return res.status(400).json({ ok: false, error: 'Maksimal 500 produk per impor.' });
  }

  const validated = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i += 1) {
    const check = validateProduct(list[i]);
    if (!check.valid) {
      return res.status(400).json({
        ok: false,
        error: 'Produk ke-' + (i + 1) + ' tidak valid: ' + check.errors[0],
      });
    }
    let id = check.data.id;
    if (seen.has(id)) {
      const base = id.slice(0, 56);
      let suffix = i + 1;
      id = base + '-' + suffix;
      while (seen.has(id)) {
        suffix += 1;
        id = base + '-' + suffix;
      }
    }
    seen.add(id);
    validated.push({ ...check.data, id });
  }

  dbModule.replaceAllProducts(validated);
  return res.json({ ok: true, products: dbModule.listProducts() });
});

app.post('/api/products', requireAuth, (req, res) => {
  const check = validateProduct(req.body);
  if (!check.valid) {
    return res.status(400).json({ ok: false, errors: check.errors, error: check.errors[0] });
  }
  try {
    const product = dbModule.createProduct(check.data);
    return res.status(201).json({ ok: true, product });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'Produk dengan ID tersebut sudah ada.' });
    }
    throw error;
  }
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const existing = dbModule.getProduct(req.params.id);
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'Produk tidak ditemukan.' });
  }
  const check = validateProduct({ ...req.body, id: req.params.id });
  if (!check.valid) {
    return res.status(400).json({ ok: false, errors: check.errors, error: check.errors[0] });
  }
  const product = dbModule.updateProduct(req.params.id, check.data);
  return res.json({ ok: true, product });
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
  const deleted = dbModule.deleteProduct(req.params.id);
  if (!deleted) {
    return res.status(404).json({ ok: false, error: 'Produk tidak ditemukan.' });
  }
  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Pesanan WhatsApp & rekap penjualan                                  */
/* ------------------------------------------------------------------ */

function formatRupiah(value) {
  return 'Rp ' + Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function buildOrderWhatsAppUrl(order) {
  const settings = dbModule.getSettings();
  const phone = normalizeWhatsAppNumber(settings.whatsapp_number);
  if (!/^[1-9]\d{7,14}$/.test(phone)) return null;

  const lines = [
    'Halo ' + settings.store_name + ',',
    'Saya ingin memesan:',
    '• ' + order.productName + ' x' + order.qty,
    'Total: ' + formatRupiah(order.total),
    'Kode pesanan: ' + order.id,
  ];
  if (order.customerName) lines.push('Nama: ' + order.customerName);
  if (order.note) lines.push('Catatan: ' + order.note);
  lines.push('', 'Mohon konfirmasi ketersediaan stok dan pembayaran. Terima kasih.');

  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(lines.join('\n'));
}

app.post('/api/orders', orderLimiter, (req, res) => {
  const check = validateOrderInput(req.body);
  if (!check.valid) {
    return res.status(400).json({ ok: false, errors: check.errors, error: check.errors[0] });
  }

  const result = dbModule.createOrder(check.data);
  if (!result.ok) {
    return res
      .status(result.code === 'NOT_FOUND' ? 404 : 409)
      .json({ ok: false, error: result.error });
  }

  return res.status(201).json({
    ok: true,
    order: result.order,
    whatsappUrl: buildOrderWhatsAppUrl(result.order),
  });
});

app.get('/api/orders', requireAuth, (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  let status = '';
  if (rawStatus && rawStatus !== 'semua') {
    status = validateOrderStatus(rawStatus);
    if (!status) {
      return res.status(400).json({
        ok: false,
        error: 'Status harus salah satu dari: ' + ORDER_STATUSES.join(', ') + '.',
      });
    }
  }
  res.json({ ok: true, orders: dbModule.listOrders({ status }) });
});

app.get('/api/orders/summary', requireAuth, (req, res) => {
  res.json({ ok: true, summary: dbModule.getSalesSummary() });
});

app.patch('/api/orders/:id/status', requireAuth, (req, res) => {
  const status = validateOrderStatus(req.body?.status);
  if (!status) {
    return res.status(400).json({
      ok: false,
      error: 'Status harus salah satu dari: ' + ORDER_STATUSES.join(', ') + '.',
    });
  }

  const result = dbModule.updateOrderStatus(req.params.id, status);
  if (!result.ok) {
    const code = result.code === 'NOT_FOUND' ? 404 : 409;
    return res.status(code).json({ ok: false, error: result.error });
  }

  return res.json({ ok: true, order: result.order });
});

/* ------------------------------------------------------------------ */
/* Pengaturan toko                                                     */
/* ------------------------------------------------------------------ */

app.get('/api/settings', (req, res) => {
  res.json({ ok: true, settings: dbModule.getSettings() });
});

app.put('/api/settings', requireAuth, (req, res) => {
  const check = validateSettings(req.body);
  if (!check.valid) {
    return res.status(400).json({ ok: false, errors: check.errors, error: check.errors[0] });
  }
  return res.json({ ok: true, settings: dbModule.updateSettings(check.data) });
});

app.get('/api/meta', (req, res) => {
  res.json({
    ok: true,
    categories: VALID_CATEGORIES,
    emojis: EMOJI_OPTIONS,
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', database: 'sqlite', uptime: process.uptime() });
});

/* ------------------------------------------------------------------ */
/* Aset statis & fallback SPA                                          */
/* ------------------------------------------------------------------ */

app.use(
  express.static(PUBLIC_DIR, {
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.get('*', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint API tidak ditemukan.' });
});

app.use((req, res) => {
  res.status(404).send('Halaman tidak ditemukan.');
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'Ukuran permintaan terlalu besar (maksimal 1 MB).' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ ok: false, error: 'Format JSON tidak valid.' });
  }
  console.error('[ERROR]', error);
  return res.status(500).json({ ok: false, error: 'Terjadi kesalahan pada server.' });
});

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */

function ensureAdminUser() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim() || 'admin';
  let password = process.env.ADMIN_PASSWORD || '';
  const existing = dbModule.findUserByUsername(username);

  if (!existing && dbModule.countUsers() === 0) {
    let generated = false;
    if (!password) {
      password = crypto.randomBytes(9).toString('base64url');
      generated = true;
    }
    if (password.length < 8) {
      console.error('[SALAH KONFIGURASI] ADMIN_PASSWORD minimal 8 karakter.');
      process.exit(1);
    }

    dbModule.createUser(username, hashPassword(password));
    console.log('\n[ADMIN] Akun pengelola dibuat.');
    console.log('        Username : ' + username);
    if (generated) {
      console.log('        Password : ' + password + '  (disimpan sekali, catat sekarang!)');
    } else {
      console.log('        Password : sesuai ADMIN_PASSWORD di file .env');
    }
    console.log('        Segera ganti password default.\n');
    return;
  }

  // Sinkronkan password admin dari .env saat restart, agar ADMIN_PASSWORD
  // di .env tetap menjadi sumber kredensial yang berlaku.
  if (!password) return;
  if (password.length < 8) {
    console.error('[SALAH KONFIGURASI] ADMIN_PASSWORD minimal 8 karakter.');
    process.exit(1);
  }

  if (!existing) {
    dbModule.createUser(username, hashPassword(password));
    console.log('\n[ADMIN] Akun pengelola "' + username + '" dibuat dari .env.\n');
    return;
  }

  if (!verifyPassword(password, existing.password_hash)) {
    dbModule.updateUserPassword(username, hashPassword(password));
    console.log('\n[ADMIN] Password akun "' + username + '" diperbarui dari ADMIN_PASSWORD.\n');
  }
}

dbModule.seedIfEmpty();
ensureAdminUser();

const server = app.listen(PORT, () => {
  console.log('☕ Toko Kopi Rejeki siap di http://localhost:' + PORT);
  console.log('   Database SQLite: ' + dbModule.DB_PATH);
});

function shutdown(signal) {
  console.log('\n[' + signal + '] Menutup server...');
  server.close(() => {
    try {
      dbModule.db.close();
    } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;

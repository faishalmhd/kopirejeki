import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.resolve(__dirname, '../database');
const DB_FILE = path.join(DB_DIR, 'kopirejeki.sqlite');
const SCHEMA_FILE = path.join(DB_DIR, 'schema.sqlite.sql');

let db = null;

export function persistDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

export function runSql(sql, params = []) {
  db.run(sql, params);
  persistDb();
}

export async function initDatabase() {
  if (db) return db;
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf-8');
  db.run(schemaSql);

  const userCount = queryOne('SELECT COUNT(*) AS count FROM users')?.count || 0;
  if (userCount === 0) {
    seedDummyData();
  }

  persistDb();
  return db;
}

function seedDummyData() {
  const defaultHash = bcrypt.hashSync('Password123!', 10);
  const now = new Date().toISOString();

  const users = [
    {
      id: 'usr-admin-01',
      name: 'Administrator Utama',
      email: 'admin@kopirejeki.id',
      password_hash: defaultHash,
      role: 'admin',
      shop_name: 'Platform Toko Kopi Rejeki',
      whatsapp: '6281234567890',
      address: 'Jl. Ahmad Yani No. 10, Banyuwangi',
      is_active: 1,
      created_at: now,
    },
    {
      id: 'usr-seller-01',
      name: 'Hendra Wijaya',
      email: 'seller@kopirejeki.id',
      password_hash: defaultHash,
      role: 'seller',
      shop_name: 'Toko Kopi Rejeki Pusat',
      whatsapp: '6281234567890',
      address: 'Jl. Raya Licin Km. 4, Banyuwangi',
      is_active: 1,
      created_at: now,
    },
    {
      id: 'usr-seller-02',
      name: 'Sari Kusuma',
      email: 'ijenroastery@kopirejeki.id',
      password_hash: defaultHash,
      role: 'seller',
      shop_name: 'Ijen Highland Roastery',
      whatsapp: '6281298765432',
      address: 'Desa Tamansari, Kec. Licin, Banyuwangi',
      is_active: 1,
      created_at: now,
    },
    {
      id: 'usr-buyer-01',
      name: 'Budi Santoso',
      email: 'pembeli@kopirejeki.id',
      password_hash: defaultHash,
      role: 'pembeli',
      shop_name: '',
      whatsapp: '6285712345678',
      address: 'Jl. Brawijaya No. 45, Kebalenan, Banyuwangi',
      is_active: 1,
      created_at: now,
    },
  ];

  for (const u of users) {
    db.run(
      `INSERT INTO users (id, name, email, password_hash, role, shop_name, whatsapp, address, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.name, u.email, u.password_hash, u.role, u.shop_name, u.whatsapp, u.address, u.is_active, u.created_at]
    );
  }

  const products = [
    {
      id: 'kopi-01',
      seller_id: 'usr-seller-01',
      nama: 'Arabika Ijen Natural 250g',
      kategori: 'Biji Kopi',
      harga: 78000,
      stok: 18,
      deskripsi:
        'Biji kopi single-origin lereng Gunung Ijen dengan proses pascapanen natural, menghadirkan aroma beri merah, karamel, dan keasaman segar seimbang.',
      image_url: './images/products/arabika-ijen.jpg',
      unggulan: 1,
    },
    {
      id: 'kopi-02',
      seller_id: 'usr-seller-01',
      nama: 'Robusta Dampit Sangrai Gelap 250g',
      kategori: 'Biji Kopi',
      harga: 52000,
      stok: 25,
      deskripsi:
        'Biji Robusta pilihan asal Dampit dengan profil dark roast berkarakter tebal, sentuhan cokelat hitam pekat, dan crema melimpah.',
      image_url: './images/products/robusta-dampit.jpg',
      unggulan: 0,
    },
    {
      id: 'kopi-03',
      seller_id: 'usr-seller-01',
      nama: 'Kopi Tubruk Klasik Rejeki 200g',
      kategori: 'Kopi Bubuk',
      harga: 32000,
      stok: 40,
      deskripsi:
        'Racikan bubuk kopi giling halus warisan keluarga dengan aroma harum khas kedai kopi tradisional, mantap diseduh air mendidih.',
      image_url: './images/products/kopi-tubruk.jpg',
      unggulan: 1,
    },
    {
      id: 'kopi-04',
      seller_id: 'usr-seller-01',
      nama: 'House Blend Espresso Rejeki 250g',
      kategori: 'Kopi Bubuk',
      harga: 65000,
      stok: 14,
      deskripsi:
        'Perpaduan 70% Arabika dan 30% Robusta giling medium-fine yang dirancang untuk moka pot, mesin espresso, maupun racikan kopi susu.',
      image_url: './images/products/house-blend.jpg',
      unggulan: 0,
    },
    {
      id: 'kopi-05',
      seller_id: 'usr-seller-01',
      nama: 'Es Kopi Susu Gula Aren 250ml',
      kategori: 'Siap Saji',
      harga: 20000,
      stok: 30,
      deskripsi:
        'Perpaduan espresso house blend segar, susu UHT full cream creamy, dan sirup gula aren organik asli dalam botol praktis siap minum.',
      image_url: './images/products/es-kopi-susu.jpg',
      unggulan: 1,
    },
    {
      id: 'kopi-06',
      seller_id: 'usr-seller-01',
      nama: 'Cold Brew Black Citrus 250ml',
      kategori: 'Siap Saji',
      harga: 22000,
      stok: 0,
      deskripsi:
        'Kopi seduh dingin selama 16 jam dengan sentuhan ekstrak kulit jeruk segar. Rendah asam, menyegarkan, dan tanpa tambahan gula.',
      image_url: './images/products/cold-brew-citrus.jpg',
      unggulan: 0,
    },
    {
      id: 'kopi-07',
      seller_id: 'usr-seller-01',
      nama: 'Paket Hampers Ngopi Pagi',
      kategori: 'Bundling',
      harga: 135000,
      stok: 10,
      deskripsi:
        'Kotak kado eksklusif berisi 1 Arabika Ijen 250g, 1 Kopi Tubruk Klasik 200g, gelas enamel estetik, dan kartu ucapan personal.',
      image_url: './images/products/hampers-pagi.jpg',
      unggulan: 1,
    },
    {
      id: 'kopi-08',
      seller_id: 'usr-seller-01',
      nama: 'Paket Drip Bag Nusantara (10 Sachet)',
      kategori: 'Bundling',
      harga: 85000,
      stok: 15,
      deskripsi:
        '10 sachet kopi drip praktis tinggal seduh berisi varian Arabika nusantara pilihan, cocok menemani kerja di kantor maupun perjalanan.',
      image_url: './images/products/drip-bag.jpg',
      unggulan: 0,
    },
    {
      id: 'kopi-09',
      seller_id: 'usr-seller-02',
      nama: 'Arabika Raung Black Honey 250g',
      kategori: 'Biji Kopi',
      harga: 88000,
      stok: 12,
      deskripsi:
        'Biji Arabika dataran tinggi Gunung Raung 1.400 mdpl dengan proses Black Honey yang menghasilkan rasa manis madu dan cokelat susu.',
      image_url: './images/products/arabika-raung.jpg',
      unggulan: 1,
    },
    {
      id: 'kopi-10',
      seller_id: 'usr-seller-02',
      nama: 'Teh Cascara Ijen Organik 100g',
      kategori: 'Siap Saji',
      harga: 35000,
      stok: 22,
      deskripsi:
        'Seduhan kulit buah ceri kopi Arabika organik yang dikeringkan alami, kaya antioksidan dengan cita rasa asam segar mirip hibiscus dan apel merah.',
      image_url: './images/products/cascara-tea.jpg',
      unggulan: 0,
    },
  ];

  for (const p of products) {
    db.run(
      `INSERT INTO products (id, seller_id, nama, kategori, harga, stok, deskripsi, image_url, unggulan, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.seller_id, p.nama, p.kategori, p.harga, p.stok, p.deskripsi, p.image_url, p.unggulan, now]
    );
  }

  db.run(
    `INSERT INTO orders (id, buyer_id, buyer_name, shipping_method, shipping_address, notes, subtotal, shipping_cost, total_amount, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'ORD-20261101',
      'usr-buyer-01',
      'Budi Santoso',
      'Kurir Lokal Banyuwangi',
      'Jl. Brawijaya No. 45, Kebalenan, Banyuwangi',
      'Giling medium untuk V60 ya min',
      110000,
      10000,
      120000,
      'Selesai',
      '2026-11-12T08:30:00.000Z',
    ]
  );
  db.run(
    `INSERT INTO order_items (id, order_id, product_id, seller_id, product_name, price, quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['oi-01', 'ORD-20261101', 'kopi-01', 'usr-seller-01', 'Arabika Ijen Natural 250g', 78000, 1]
  );
  db.run(
    `INSERT INTO order_items (id, order_id, product_id, seller_id, product_name, price, quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['oi-02', 'ORD-20261101', 'kopi-03', 'usr-seller-01', 'Kopi Tubruk Klasik Rejeki 200g', 32000, 1]
  );

  db.run(
    `INSERT INTO orders (id, buyer_id, buyer_name, shipping_method, shipping_address, notes, subtotal, shipping_cost, total_amount, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'ORD-20261114',
      'usr-buyer-01',
      'Budi Santoso',
      'Ambil di Kedai',
      'Ambil langsung di outlet Toko Kopi Rejeki',
      'Diambil sore jam 16.00',
      88000,
      0,
      88000,
      'Diproses',
      '2026-11-15T10:15:00.000Z',
    ]
  );
  db.run(
    `INSERT INTO order_items (id, order_id, product_id, seller_id, product_name, price, quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['oi-03', 'ORD-20261114', 'kopi-09', 'usr-seller-02', 'Arabika Raung Black Honey 250g', 88000, 1]
  );

  const reviews = [
    ['rev-01', 'kopi-01', 'usr-buyer-01', 'Budi Santoso', 5, 'Aroma fruity natural-nya wangi banget begitu kemasan dibuka. Cocok diseduh V60 pagi hari!', '2026-11-13T09:00:00.000Z'],
    ['rev-02', 'kopi-03', 'usr-buyer-01', 'Budi Santoso', 5, 'Kopi tubruk andalan keluarga, ampas cepat turun dan rasanya mantap tanpa bikin perih di lambung.', '2026-11-13T09:05:00.000Z'],
    ['rev-03', 'kopi-05', 'usr-buyer-01', 'Budi Santoso', 4, 'Gula arennya pas tidak kemanisan, kopinya tetap terasa bold.', '2026-11-14T14:20:00.000Z'],
    ['rev-04', 'kopi-09', 'usr-buyer-01', 'Budi Santoso', 5, 'Aftertaste manis madu khas kopi Raung terasa jelas. Packing aman dan rapi.', '2026-11-15T11:00:00.000Z'],
  ];

  for (const r of reviews) {
    db.run(
      `INSERT INTO reviews (id, product_id, buyer_id, buyer_name, rating, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      r
    );
  }
}

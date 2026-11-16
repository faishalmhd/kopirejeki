import { parseProductsJSON, validateProduct } from './store.js';

const DEMO_USERS_KEY = 'kopirejeki:fallback:users:v2';
const DEMO_PRODUCTS_KEY = 'kopirejeki:fallback:products:v2';
const DEMO_ORDERS_KEY = 'kopirejeki:fallback:orders:v2';
const DEMO_REVIEWS_KEY = 'kopirejeki:fallback:reviews:v2';
const DEMO_SESSION_KEY = 'kopirejeki:fallback:session:v2';

let backendMode = 'checking';

const SEED_USERS = [
  {
    id: 'usr-admin-01',
    name: 'Administrator Utama',
    email: 'admin@kopirejeki.id',
    password: 'Password123!',
    role: 'admin',
    shop_name: 'Platform Toko Kopi Rejeki',
    whatsapp: '6281234567890',
    address: 'Jl. Ahmad Yani No. 10, Banyuwangi',
    is_active: 1,
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'usr-seller-01',
    name: 'Hendra Wijaya',
    email: 'seller@kopirejeki.id',
    password: 'Password123!',
    role: 'seller',
    shop_name: 'Toko Kopi Rejeki Pusat',
    whatsapp: '6281234567890',
    address: 'Jl. Raya Licin Km. 4, Banyuwangi',
    is_active: 1,
    created_at: '2026-11-01T08:05:00.000Z',
  },
  {
    id: 'usr-seller-02',
    name: 'Sari Kusuma',
    email: 'ijenroastery@kopirejeki.id',
    password: 'Password123!',
    role: 'seller',
    shop_name: 'Ijen Highland Roastery',
    whatsapp: '6281298765432',
    address: 'Desa Tamansari, Kec. Licin, Banyuwangi',
    is_active: 1,
    created_at: '2026-11-01T08:10:00.000Z',
  },
  {
    id: 'usr-buyer-01',
    name: 'Budi Santoso',
    email: 'pembeli@kopirejeki.id',
    password: 'Password123!',
    role: 'pembeli',
    shop_name: '',
    whatsapp: '6285712345678',
    address: 'Jl. Brawijaya No. 45, Kebalenan, Banyuwangi',
    is_active: 1,
    created_at: '2026-11-01T08:15:00.000Z',
  },
];

const SEED_PRODUCTS = [
  {
    id: 'kopi-01',
    seller_id: 'usr-seller-01',
    nama: 'Arabika Ijen Natural 250g',
    kategori: 'Biji Kopi',
    harga: 78000,
    stok: 18,
    deskripsi:
      'Biji kopi single-origin lereng Gunung Ijen dengan proses pascapanen natural, menghadirkan aroma beri merah, karamel, dan keasaman segar seimbang.',
    imageUrl: './images/products/arabika-ijen.jpg',
    unggulan: true,
    created_at: '2026-11-01T09:00:00.000Z',
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
    imageUrl: './images/products/robusta-dampit.jpg',
    unggulan: false,
    created_at: '2026-11-01T09:01:00.000Z',
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
    imageUrl: './images/products/kopi-tubruk.jpg',
    unggulan: true,
    created_at: '2026-11-01T09:02:00.000Z',
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
    imageUrl: './images/products/house-blend.jpg',
    unggulan: false,
    created_at: '2026-11-01T09:03:00.000Z',
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
    imageUrl: './images/products/es-kopi-susu.jpg',
    unggulan: true,
    created_at: '2026-11-01T09:04:00.000Z',
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
    imageUrl: './images/products/cold-brew-citrus.jpg',
    unggulan: false,
    created_at: '2026-11-01T09:05:00.000Z',
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
    imageUrl: './images/products/hampers-pagi.jpg',
    unggulan: true,
    created_at: '2026-11-01T09:06:00.000Z',
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
    imageUrl: './images/products/drip-bag.jpg',
    unggulan: false,
    created_at: '2026-11-01T09:07:00.000Z',
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
    imageUrl: './images/products/arabika-raung.jpg',
    unggulan: true,
    created_at: '2026-11-01T09:08:00.000Z',
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
    imageUrl: './images/products/cascara-tea.jpg',
    unggulan: false,
    created_at: '2026-11-01T09:09:00.000Z',
  },
];

const SEED_ORDERS = [
  {
    id: 'ORD-20261101',
    buyer_id: 'usr-buyer-01',
    buyer_name: 'Budi Santoso',
    shipping_method: 'Kurir Lokal Banyuwangi',
    shipping_address: 'Jl. Brawijaya No. 45, Kebalenan, Banyuwangi',
    notes: 'Giling medium untuk V60 ya min',
    subtotal: 110000,
    shipping_cost: 10000,
    total_amount: 120000,
    status: 'Selesai',
    created_at: '2026-11-12T08:30:00.000Z',
    items: [
      { id: 'oi-01', product_id: 'kopi-01', seller_id: 'usr-seller-01', product_name: 'Arabika Ijen Natural 250g', price: 78000, quantity: 1 },
      { id: 'oi-02', product_id: 'kopi-03', seller_id: 'usr-seller-01', product_name: 'Kopi Tubruk Klasik Rejeki 200g', price: 32000, quantity: 1 },
    ],
  },
  {
    id: 'ORD-20261114',
    buyer_id: 'usr-buyer-01',
    buyer_name: 'Budi Santoso',
    shipping_method: 'Ambil di Kedai',
    shipping_address: 'Ambil langsung di outlet Toko Kopi Rejeki',
    notes: 'Diambil sore jam 16.00',
    subtotal: 88000,
    shipping_cost: 0,
    total_amount: 88000,
    status: 'Diproses',
    created_at: '2026-11-15T10:15:00.000Z',
    items: [
      { id: 'oi-03', product_id: 'kopi-09', seller_id: 'usr-seller-02', product_name: 'Arabika Raung Black Honey 250g', price: 88000, quantity: 1 },
    ],
  },
];

const SEED_REVIEWS = [
  { id: 'rev-01', product_id: 'kopi-01', buyer_id: 'usr-buyer-01', buyer_name: 'Budi Santoso', rating: 5, comment: 'Aroma fruity natural-nya wangi banget begitu kemasan dibuka. Cocok diseduh V60 pagi hari!', created_at: '2026-11-13T09:00:00.000Z' },
  { id: 'rev-02', product_id: 'kopi-03', buyer_id: 'usr-buyer-01', buyer_name: 'Budi Santoso', rating: 5, comment: 'Kopi tubruk andalan keluarga, ampas cepat turun dan rasanya mantap.', created_at: '2026-11-13T09:05:00.000Z' },
  { id: 'rev-03', product_id: 'kopi-05', buyer_id: 'usr-buyer-01', buyer_name: 'Budi Santoso', rating: 4, comment: 'Gula arennya pas tidak kemanisan, kopinya tetap terasa bold.', created_at: '2026-11-14T14:20:00.000Z' },
  { id: 'rev-04', product_id: 'kopi-09', buyer_id: 'usr-buyer-01', buyer_name: 'Budi Santoso', rating: 5, comment: 'Aftertaste manis madu khas kopi Raung terasa jelas. Packing aman.', created_at: '2026-11-15T11:00:00.000Z' },
];

function ensureFallbackStore() {
  if (!localStorage.getItem(DEMO_USERS_KEY)) {
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(SEED_USERS));
  }
  if (!localStorage.getItem(DEMO_PRODUCTS_KEY)) {
    localStorage.setItem(DEMO_PRODUCTS_KEY, JSON.stringify(SEED_PRODUCTS));
  }
  if (!localStorage.getItem(DEMO_ORDERS_KEY)) {
    localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(SEED_ORDERS));
  }
  if (!localStorage.getItem(DEMO_REVIEWS_KEY)) {
    localStorage.setItem(DEMO_REVIEWS_KEY, JSON.stringify(SEED_REVIEWS));
  }
}

function getFallbackData(key, fallback) {
  ensureFallbackStore();
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function setFallbackData(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function getFallbackCurrentUser() {
  const userId = localStorage.getItem(DEMO_SESSION_KEY);
  if (!userId) return null;
  const users = getFallbackData(DEMO_USERS_KEY, SEED_USERS);
  const found = users.find((u) => u.id === userId && u.is_active);
  if (!found) return null;
  const { password: _p, ...safe } = found;
  return safe;
}

function enrichFallbackProducts() {
  const users = getFallbackData(DEMO_USERS_KEY, SEED_USERS);
  const products = getFallbackData(DEMO_PRODUCTS_KEY, SEED_PRODUCTS);
  const reviews = getFallbackData(DEMO_REVIEWS_KEY, SEED_REVIEWS);

  return products.map((p) => {
    const seller = users.find((u) => u.id === p.seller_id) || {};
    const prodReviews = reviews.filter((r) => r.product_id === p.id);
    const avg =
      prodReviews.length > 0
        ? Math.round((prodReviews.reduce((s, r) => s + r.rating, 0) / prodReviews.length) * 10) / 10
        : 0;
    return {
      ...p,
      seller_name: seller.name || 'Mitra UMKM',
      shop_name: seller.shop_name || 'Toko Kopi Rejeki',
      seller_whatsapp: seller.whatsapp || '6281234567890',
      avg_rating: avg,
      review_count: prodReviews.length,
    };
  });
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Terjadi kesalahan (${res.status})`);
  }
  return data;
}

export async function detectBackendMode() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      if (json && json.ok) {
        backendMode = 'server';
        return backendMode;
      }
    }
  } catch {}
  ensureFallbackStore();
  backendMode = 'fallback';
  return backendMode;
}

export function getBackendMode() {
  return backendMode;
}

export async function apiGetMe() {
  if (backendMode === 'server') {
    const data = await request('/api/auth/me');
    return data.user;
  }
  return getFallbackCurrentUser();
}

export async function apiLogin(email, password) {
  if (backendMode === 'server') {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return data.user;
  }

  const users = getFallbackData(DEMO_USERS_KEY, SEED_USERS);
  const found = users.find(
    (u) => u.email.toLowerCase() === String(email).trim().toLowerCase() && u.password === password
  );
  if (!found) throw new Error('Email atau kata sandi salah.');
  if (!found.is_active) throw new Error('Akun dinonaktifkan oleh Admin.');
  localStorage.setItem(DEMO_SESSION_KEY, found.id);
  const { password: _p, ...safe } = found;
  return safe;
}

export async function apiRegister(payload) {
  if (backendMode === 'server') {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.user;
  }

  const { name, email, password, role, shopName, whatsapp, address } = payload;
  if (!name || name.trim().length < 2) throw new Error('Nama lengkap minimal 2 karakter.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) throw new Error('Format email tidak valid.');
  if (!password || password.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
  const cleanRole = role === 'seller' ? 'seller' : 'pembeli';
  if (cleanRole === 'seller' && (!shopName || shopName.trim().length < 3)) {
    throw new Error('Nama Toko UMKM wajib diisi minimal 3 karakter.');
  }

  const users = getFallbackData(DEMO_USERS_KEY, SEED_USERS);
  if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    throw new Error('Email sudah terdaftar.');
  }

  const newUser = {
    id: `usr-${Date.now().toString(36)}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    role: cleanRole,
    shop_name: cleanRole === 'seller' ? shopName.trim() : '',
    whatsapp: String(whatsapp || '').replace(/[^\d]/g, ''),
    address: String(address || '').trim(),
    is_active: 1,
    created_at: new Date().toISOString(),
  };

  users.push(newUser);
  setFallbackData(DEMO_USERS_KEY, users);
  localStorage.setItem(DEMO_SESSION_KEY, newUser.id);
  const { password: _p, ...safe } = newUser;
  return safe;
}

export async function apiLogout() {
  if (backendMode === 'server') {
    await request('/api/auth/logout', { method: 'POST' });
    return;
  }
  localStorage.removeItem(DEMO_SESSION_KEY);
}

export async function apiGetProducts() {
  if (backendMode === 'server') {
    const data = await request('/api/products');
    return data.products;
  }
  return enrichFallbackProducts();
}

export async function apiGetProductDetail(id) {
  if (backendMode === 'server') {
    return request(`/api/products/${encodeURIComponent(id)}`);
  }
  const products = enrichFallbackProducts();
  const product = products.find((p) => p.id === id);
  if (!product) throw new Error('Produk tidak ditemukan.');
  const reviews = getFallbackData(DEMO_REVIEWS_KEY, SEED_REVIEWS).filter((r) => r.product_id === id);
  return { product, reviews };
}

export async function apiUploadImage(filename, dataUrl) {
  if (backendMode === 'server') {
    const data = await request('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ filename, dataUrl }),
    });
    return data.imageUrl;
  }
  return dataUrl;
}

export async function apiCreateProduct(payload) {
  if (backendMode === 'server') {
    const data = await request('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.product;
  }

  const user = getFallbackCurrentUser();
  if (!user || !['seller', 'admin'].includes(user.role)) {
    throw new Error('Akses ditolak.');
  }
  const check = validateProduct(payload);
  if (!check.valid) throw new Error(check.errors[0]);

  const products = getFallbackData(DEMO_PRODUCTS_KEY, SEED_PRODUCTS);
  const created = {
    ...check.data,
    seller_id: user.id,
    created_at: new Date().toISOString(),
  };
  products.unshift(created);
  setFallbackData(DEMO_PRODUCTS_KEY, products);
  return created;
}

export async function apiUpdateProduct(id, payload) {
  if (backendMode === 'server') {
    const data = await request(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return data.product;
  }

  const user = getFallbackCurrentUser();
  const products = getFallbackData(DEMO_PRODUCTS_KEY, SEED_PRODUCTS);
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Produk tidak ditemukan.');
  if (user.role !== 'admin' && products[idx].seller_id !== user.id) {
    throw new Error('Anda tidak berhak mengubah produk milik toko lain.');
  }

  const check = validateProduct({ ...payload, id });
  if (!check.valid) throw new Error(check.errors[0]);

  products[idx] = { ...products[idx], ...check.data, id };
  setFallbackData(DEMO_PRODUCTS_KEY, products);
  return products[idx];
}

export async function apiDeleteProduct(id) {
  if (backendMode === 'server') {
    await request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return;
  }

  const user = getFallbackCurrentUser();
  const products = getFallbackData(DEMO_PRODUCTS_KEY, SEED_PRODUCTS);
  const target = products.find((p) => p.id === id);
  if (!target) throw new Error('Produk tidak ditemukan.');
  if (user.role !== 'admin' && target.seller_id !== user.id) {
    throw new Error('Anda tidak berhak menghapus produk milik toko lain.');
  }
  setFallbackData(
    DEMO_PRODUCTS_KEY,
    products.filter((p) => p.id !== id)
  );
}

export async function apiBulkImportProducts(jsonString) {
  const parsed = parseProductsJSON(jsonString);
  if (!parsed.ok) throw new Error(parsed.error);

  for (const item of parsed.products) {
    await apiCreateProduct(item);
  }
  return parsed.products.length;
}

export async function apiSubmitReview(productId, rating, comment) {
  if (backendMode === 'server') {
    await request(`/api/products/${encodeURIComponent(productId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
    return;
  }

  const user = getFallbackCurrentUser();
  if (!user) throw new Error('Silakan login terlebih dahulu.');
  const reviews = getFallbackData(DEMO_REVIEWS_KEY, SEED_REVIEWS);
  reviews.unshift({
    id: `rev-${Date.now().toString(36)}`,
    product_id: productId,
    buyer_id: user.id,
    buyer_name: user.name,
    rating: Number(rating),
    comment: String(comment).trim(),
    created_at: new Date().toISOString(),
  });
  setFallbackData(DEMO_REVIEWS_KEY, reviews);
}

export async function apiCreateOrder(payload) {
  if (backendMode === 'server') {
    return request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const user = getFallbackCurrentUser();
  if (!user) throw new Error('Silakan login terlebih dahulu.');

  const products = getFallbackData(DEMO_PRODUCTS_KEY, SEED_PRODUCTS);
  const orders = getFallbackData(DEMO_ORDERS_KEY, SEED_ORDERS);

  let subtotal = 0;
  const orderItems = [];

  for (const item of payload.items) {
    const prod = products.find((p) => p.id === item.productId);
    if (!prod) throw new Error('Produk tidak ditemukan.');
    if (prod.stok < item.quantity) throw new Error(`Stok ${prod.nama} tidak mencukupi.`);
    prod.stok -= item.quantity;
    subtotal += prod.harga * item.quantity;
    orderItems.push({
      id: `oi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      product_id: prod.id,
      seller_id: prod.seller_id,
      product_name: prod.nama,
      price: prod.harga,
      quantity: item.quantity,
    });
  }

  const shippingCost =
    payload.shippingMethod === 'Ambil di Kedai'
      ? 0
      : payload.shippingMethod === 'Ekspedisi Reguler'
        ? 18000
        : 10000;

  const orderId = `ORD-${Date.now().toString().slice(-8)}`;
  orders.unshift({
    id: orderId,
    buyer_id: user.id,
    buyer_name: user.name,
    shipping_method: payload.shippingMethod,
    shipping_address: payload.shippingAddress,
    notes: payload.notes || '',
    subtotal,
    shipping_cost: shippingCost,
    total_amount: subtotal + shippingCost,
    status: 'Menunggu Konfirmasi',
    created_at: new Date().toISOString(),
    items: orderItems,
  });

  setFallbackData(DEMO_PRODUCTS_KEY, products);
  setFallbackData(DEMO_ORDERS_KEY, orders);
  return { ok: true, orderId, totalAmount: subtotal + shippingCost };
}

export async function apiGetOrders() {
  if (backendMode === 'server') {
    const data = await request('/api/orders');
    return data.orders;
  }

  const user = getFallbackCurrentUser();
  if (!user) return [];
  const orders = getFallbackData(DEMO_ORDERS_KEY, SEED_ORDERS);
  if (user.role === 'admin') return orders;
  if (user.role === 'seller') {
    return orders
      .filter((o) => o.items.some((i) => i.seller_id === user.id))
      .map((o) => ({
        ...o,
        items: o.items.filter((i) => i.seller_id === user.id),
      }));
  }
  return orders.filter((o) => o.buyer_id === user.id);
}

export async function apiUpdateOrderStatus(orderId, status) {
  if (backendMode === 'server') {
    await request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return;
  }

  const orders = getFallbackData(DEMO_ORDERS_KEY, SEED_ORDERS);
  const target = orders.find((o) => o.id === orderId);
  if (target) {
    target.status = status;
    setFallbackData(DEMO_ORDERS_KEY, orders);
  }
}

export async function apiGetAdminUsers() {
  if (backendMode === 'server') {
    const data = await request('/api/admin/users');
    return data.users;
  }

  const users = getFallbackData(DEMO_USERS_KEY, SEED_USERS);
  return users.map(({ password: _p, ...safe }) => safe);
}

export async function apiUpdateAdminUser(userId, payload) {
  if (backendMode === 'server') {
    await request(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return;
  }

  const users = getFallbackData(DEMO_USERS_KEY, SEED_USERS);
  const target = users.find((u) => u.id === userId);
  if (target) {
    if (payload.role) target.role = payload.role;
    if (typeof payload.is_active === 'boolean') target.is_active = payload.is_active ? 1 : 0;
    setFallbackData(DEMO_USERS_KEY, users);
  }
}

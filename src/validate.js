'use strict';

const crypto = require('node:crypto');

const VALID_CATEGORIES = ['Biji Kopi', 'Kopi Bubuk', 'Siap Saji', 'Bundling'];
const EMOJI_OPTIONS = ['☕', '🫘', '🧊', '🎁', '🫖', '🥐'];
const DEFAULT_EMOJI = '☕';
const ORDER_STATUSES = ['baru', 'selesai', 'dibatalkan'];

function generateProductId() {
  return 'kopi-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
}

function generateOrderId() {
  return 'ord-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isBlank(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function isTruthyFlag(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function validateProduct(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['Data produk tidak valid.'], data: null };
  }

  const nama = cleanText(input.nama);
  if (!nama) errors.push('Nama produk wajib diisi.');
  else if (nama.length > 100) errors.push('Nama produk maksimal 100 karakter.');

  const kategori = cleanText(input.kategori);
  if (!VALID_CATEGORIES.includes(kategori)) {
    errors.push('Kategori harus salah satu dari: ' + VALID_CATEGORIES.join(', ') + '.');
  }

  const hargaRaw = input.harga;
  const harga = Number(hargaRaw);
  if (
    isBlank(hargaRaw) ||
    typeof hargaRaw === 'boolean' ||
    (typeof hargaRaw === 'object' && hargaRaw !== null) ||
    !Number.isFinite(harga) ||
    harga < 0 ||
    harga > 1000000000
  ) {
    errors.push('Harga harus berupa angka antara 0 dan 1.000.000.000.');
  }

  const stokRaw = input.stok;
  const stok = Number(stokRaw);
  if (
    isBlank(stokRaw) ||
    typeof stokRaw === 'boolean' ||
    (typeof stokRaw === 'object' && stokRaw !== null) ||
    !Number.isFinite(stok) ||
    !Number.isInteger(stok) ||
    stok < 0 ||
    stok > 1000000
  ) {
    errors.push('Stok harus berupa bilangan bulat antara 0 dan 1.000.000.');
  }

  const deskripsi = cleanText(input.deskripsi);
  if (deskripsi.length > 500) errors.push('Deskripsi maksimal 500 karakter.');

  let imageUrl = cleanText(input.imageUrl) || DEFAULT_EMOJI;
  if (imageUrl.length > 200) {
    errors.push('Ikon/URL gambar terlalu panjang (maksimal 200 karakter).');
  }
  const lowerImg = imageUrl.toLowerCase();
  if (
    lowerImg.startsWith('javascript:') ||
    lowerImg.startsWith('data:') ||
    lowerImg.startsWith('vbscript:')
  ) {
    errors.push('Ikon/URL gambar tidak diizinkan.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  const providedId = cleanText(input.id);
  if (providedId && !/^[A-Za-z0-9_-]{1,64}$/.test(providedId)) {
    errors.push('ID produk hanya boleh huruf, angka, tanda hubung, dan garis bawah (maksimal 64 karakter).');
  }
  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }
  const id = providedId || generateProductId();

  return {
    valid: true,
    errors: [],
    data: {
      id,
      nama,
      kategori,
      harga: Math.round(harga),
      stok,
      deskripsi,
      imageUrl,
      unggulan: isTruthyFlag(input.unggulan),
    },
  };
}

function normalizeWhatsAppNumber(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

function validateSettings(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['Data pengaturan tidak valid.'], data: null };
  }

  const storeName = cleanText(input.store_name);
  if (!storeName) errors.push('Nama toko wajib diisi.');
  else if (storeName.length > 80) errors.push('Nama toko maksimal 80 karakter.');

  const storeTagline = cleanText(input.store_tagline);
  if (storeTagline.length > 120) errors.push('Tagline maksimal 120 karakter.');

  const whatsappNumber = normalizeWhatsAppNumber(input.whatsapp_number);
  if (!/^[1-9]\d{7,14}$/.test(whatsappNumber)) {
    errors.push('Nomor WhatsApp tidak valid. Gunakan format 08xx atau 62xx.');
  }

  const storeAddress = cleanText(input.store_address);
  if (storeAddress.length > 200) errors.push('Alamat maksimal 200 karakter.');

  const storeHours = cleanText(input.store_hours);
  if (storeHours.length > 100) errors.push('Jam operasional maksimal 100 karakter.');

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      store_name: storeName,
      store_tagline: storeTagline,
      whatsapp_number: whatsappNumber,
      store_address: storeAddress,
      store_hours: storeHours,
    },
  };
}

function validateOrderInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['Data pesanan tidak valid.'], data: null };
  }

  const productId = cleanText(input.product_id ?? input.productId);
  if (!productId) errors.push('Produk wajib dipilih.');
  else if (!/^[A-Za-z0-9_-]{1,64}$/.test(productId)) errors.push('ID produk tidak valid.');

  const qtyRaw = input.qty;
  const qty = Number(qtyRaw);
  if (
    isBlank(qtyRaw) ||
    typeof qtyRaw === 'boolean' ||
    (typeof qtyRaw === 'object' && qtyRaw !== null) ||
    !Number.isFinite(qty) ||
    !Number.isInteger(qty) ||
    qty < 1 ||
    qty > 1000000
  ) {
    errors.push('Jumlah pesanan harus bilangan bulat antara 1 dan 1.000.000.');
  }

  const customerName = cleanText(input.customer_name ?? input.customerName);
  if (customerName.length > 80) errors.push('Nama pelanggan maksimal 80 karakter.');

  const note = cleanText(input.note);
  if (note.length > 200) errors.push('Catatan maksimal 200 karakter.');

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      productId,
      qty,
      customerName,
      note,
    },
  };
}

function validateOrderStatus(value) {
  const status = cleanText(value);
  return ORDER_STATUSES.includes(status) ? status : null;
}

module.exports = {
  VALID_CATEGORIES,
  EMOJI_OPTIONS,
  DEFAULT_EMOJI,
  ORDER_STATUSES,
  validateProduct,
  validateSettings,
  validateOrderInput,
  validateOrderStatus,
  normalizeWhatsAppNumber,
  generateProductId,
  generateOrderId,
};

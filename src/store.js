export const DEFAULT_WHATSAPP = '6281234567890';
export const VALID_CATEGORIES = ['Biji Kopi', 'Kopi Bubuk', 'Siap Saji', 'Bundling'];

export const PRESET_IMAGES = [
  { label: 'Arabika Ijen Natural', url: './images/products/arabika-ijen.jpg' },
  { label: 'Robusta Dampit Dark', url: './images/products/robusta-dampit.jpg' },
  { label: 'Kopi Tubruk Klasik', url: './images/products/kopi-tubruk.jpg' },
  { label: 'House Blend Espresso', url: './images/products/house-blend.jpg' },
  { label: 'Es Kopi Susu Gula Aren', url: './images/products/es-kopi-susu.jpg' },
  { label: 'Cold Brew Black Citrus', url: './images/products/cold-brew-citrus.jpg' },
  { label: 'Paket Hampers Pagi', url: './images/products/hampers-pagi.jpg' },
  { label: 'Paket Drip Bag Nusantara', url: './images/products/drip-bag.jpg' },
  { label: 'Arabika Raung Black Honey', url: './images/products/arabika-raung.jpg' },
  { label: 'Teh Cascara Ijen Organik', url: './images/products/cascara-tea.jpg' },
];

export function formatRupiah(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return 'Rp 0';
  return 'Rp ' + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateProduct(input) {
  const errors = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Data produk tidak valid.'] };
  }

  const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
  if (!nama) errors.push('Nama produk wajib diisi.');
  else if (nama.length > 120) errors.push('Nama produk maksimal 120 karakter.');

  const kategori = typeof input.kategori === 'string' ? input.kategori.trim() : '';
  if (!VALID_CATEGORIES.includes(kategori)) {
    errors.push(`Kategori harus salah satu dari: ${VALID_CATEGORIES.join(', ')}.`);
  }

  const harga = Number(input.harga);
  if (
    input.harga === '' ||
    input.harga === null ||
    typeof input.harga === 'boolean' ||
    !Number.isFinite(harga) ||
    harga < 0
  ) {
    errors.push('Harga harus berupa angka >= 0.');
  }

  const stok = Number(input.stok);
  if (
    input.stok === '' ||
    input.stok === null ||
    typeof input.stok === 'boolean' ||
    !Number.isFinite(stok) ||
    !Number.isInteger(stok) ||
    stok < 0
  ) {
    errors.push('Stok harus berupa bilangan bulat >= 0.');
  }

  const deskripsi = typeof input.deskripsi === 'string' ? input.deskripsi.trim() : '';
  if (deskripsi.length > 600) errors.push('Deskripsi maksimal 600 karakter.');

  const imageUrl =
    typeof input.imageUrl === 'string' && input.imageUrl.trim()
      ? input.imageUrl.trim()
      : './images/products/arabika-ijen.jpg';

  const lowerImg = imageUrl.toLowerCase();
  if (lowerImg.startsWith('javascript:') || lowerImg.startsWith('vbscript:')) {
    errors.push('URL gambar tidak diizinkan.');
  }

  if (errors.length > 0) return { valid: false, errors };

  const id =
    typeof input.id === 'string' && input.id.trim()
      ? input.id.trim()
      : `kopi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

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
      unggulan: Boolean(input.unggulan),
    },
  };
}

export function filterProducts(products, { query = '', kategori = 'Semua', sort = 'default' } = {}) {
  if (!Array.isArray(products)) return [];
  const normalizedQuery = String(query ?? '').trim().toLowerCase();

  const filtered = products.filter((item) => {
    const matchCategory = !kategori || kategori === 'Semua' || item.kategori === kategori;
    if (!matchCategory) return false;
    if (!normalizedQuery) return true;

    const nama = String(item.nama ?? '').toLowerCase();
    const deskripsi = String(item.deskripsi ?? '').toLowerCase();
    const shop = String(item.shop_name ?? '').toLowerCase();
    return nama.includes(normalizedQuery) || deskripsi.includes(normalizedQuery) || shop.includes(normalizedQuery);
  });

  const sorted = [...filtered];
  if (sort === 'termurah') sorted.sort((a, b) => a.harga - b.harga);
  else if (sort === 'termahal') sorted.sort((a, b) => b.harga - a.harga);
  else if (sort === 'nama-asc') sorted.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  else if (sort === 'rating') sorted.sort((a, b) => (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0));
  else sorted.sort((a, b) => Number(Boolean(b.unggulan)) - Number(Boolean(a.unggulan)));

  return sorted;
}

export function buildWhatsAppUrl(nomor, produk) {
  if (!produk || typeof produk !== 'object') return null;
  const stok = Number(produk.stok);
  if (!Number.isFinite(stok) || stok <= 0) return null;

  const cleanPhone = String(nomor || DEFAULT_WHATSAPP).replace(/[\s\-()+]/g, '');
  if (!/^[1-9]\d{7,14}$/.test(cleanPhone)) return null;

  const nama = String(produk.nama ?? '').trim();
  if (!nama) return null;

  const shopLabel = produk.shop_name ? ` (${produk.shop_name})` : '';
  const pesan = `Halo Toko Kopi Rejeki${shopLabel}, saya ingin memesan ${nama} (Harga: ${formatRupiah(produk.harga)}). Apakah stok masih tersedia?`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(pesan)}`;
}

export function parseProductsJSON(jsonString) {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    return { ok: false, error: 'File JSON kosong.', products: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: 'Format JSON tidak valid.', products: null };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, error: 'JSON harus berisi array produk yang tidak kosong.', products: null };
  }

  const validated = [];
  const seenIds = new Set();
  for (let i = 0; i < parsed.length; i += 1) {
    const check = validateProduct({
      ...parsed[i],
      imageUrl: parsed[i].imageUrl || parsed[i].image_url,
    });
    if (!check.valid) {
      return { ok: false, error: `Produk ke-${i + 1}: ${check.errors[0]}`, products: null };
    }
    let uniqueId = check.data.id;
    if (seenIds.has(uniqueId)) uniqueId = `${uniqueId}-${i + 1}`;
    seenIds.add(uniqueId);
    validated.push({ ...check.data, id: uniqueId });
  }
  return { ok: true, error: null, products: validated };
}

export function calculateCartTotals(cartItems, shippingMethod = 'Kurir Lokal Banyuwangi') {
  const list = Array.isArray(cartItems) ? cartItems : [];
  const itemCount = list.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const subtotal = list.reduce((sum, item) => sum + (Number(item.harga) || 0) * (Number(item.quantity) || 0), 0);
  const shippingCost =
    itemCount === 0
      ? 0
      : shippingMethod === 'Ambil di Kedai'
        ? 0
        : shippingMethod === 'Ekspedisi Reguler'
          ? 18000
          : 10000;
  return {
    itemCount,
    subtotal,
    shippingCost,
    total: subtotal + shippingCost,
  };
}

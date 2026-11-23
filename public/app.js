'use strict';

const DEFAULT_SETTINGS = {
  store_name: 'Toko Kopi Rejeki',
  store_tagline: 'UMKM Roastery & Kedai Lokal',
  whatsapp_number: '6281234567890',
  store_address: 'Jl. Contoh No. 1, Malang, Jawa Timur',
  store_hours: 'Setiap hari, 08.00 – 21.00 WIB',
};

const FALLBACK_CATEGORIES = ['Biji Kopi', 'Kopi Bubuk', 'Siap Saji', 'Bundling'];
const FALLBACK_EMOJIS = ['☕', '🫘', '🧊', '🎁', '🫖', '🥐'];

const appContainer = document.getElementById('app');

const state = {
  activeTab: 'katalog',
  products: [],
  settings: { ...DEFAULT_SETTINGS },
  categories: [...FALLBACK_CATEGORIES],
  emojis: [...FALLBACK_EMOJIS],
  filters: { query: '', kategori: 'Semua', sort: 'default' },
  user: null,
  loading: true,
  loadError: '',
  online: true,
  busy: false,
  toast: null,
  loginError: '',
  loginUsername: '',
  isFormOpen: false,
  editingProduct: null,
  formDraft: null,
  formErrors: [],
  isSettingsOpen: false,
  settingsDraft: null,
  settingsErrors: [],
};

let toastTimer = null;

/* ------------------------------------------------------------------ */
/* Utilitas                                                            */
/* ------------------------------------------------------------------ */

function formatRupiah(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return 'Rp 0';
  return 'Rp ' + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

function formatPhoneDisplay(raw) {
  const digits = normalizePhone(raw);
  if (!digits) return 'Belum diatur';
  const rest = digits.startsWith('62') ? digits.slice(2) : digits;
  const grouped = rest.replace(/^(\d{2,4})(\d{3,4})(\d+)$/, '$1-$2-$3');
  return '+62 ' + grouped;
}

function buildWhatsAppUrl(product) {
  if (!product || !(Number(product.stok) > 0)) return null;
  const phone = normalizePhone(state.settings.whatsapp_number);
  if (!/^[1-9]\d{7,14}$/.test(phone)) return null;
  const nama = String(product.nama ?? '').trim();
  if (!nama) return null;
  const pesan =
    'Halo ' +
    state.settings.store_name +
    ', saya ingin memesan ' +
    nama +
    ' (Harga: ' +
    formatRupiah(product.harga) +
    '). Apakah stok masih tersedia?';
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(pesan);
}

function filterProducts(products, { query = '', kategori = 'Semua', sort = 'default' } = {}) {
  if (!Array.isArray(products)) return [];
  const normalizedQuery = String(query ?? '').trim().toLowerCase();

  const filtered = products.filter((item) => {
    const matchCategory = !kategori || kategori === 'Semua' || item.kategori === kategori;
    if (!matchCategory) return false;
    if (!normalizedQuery) return true;
    const nama = String(item.nama ?? '').toLowerCase();
    const deskripsi = String(item.deskripsi ?? '').toLowerCase();
    return nama.includes(normalizedQuery) || deskripsi.includes(normalizedQuery);
  });

  const sorted = [...filtered];
  if (sort === 'termurah') sorted.sort((a, b) => a.harga - b.harga);
  else if (sort === 'termahal') sorted.sort((a, b) => b.harga - a.harga);
  else if (sort === 'nama-asc') sorted.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  else sorted.sort((a, b) => Number(Boolean(b.unggulan)) - Number(Boolean(a.unggulan)));

  return sorted;
}

function getDashboardStats(products) {
  const list = Array.isArray(products) ? products : [];
  return {
    totalProduk: list.length,
    totalStok: list.reduce((sum, item) => sum + (Number(item.stok) || 0), 0),
    kategoriAktif: new Set(list.map((item) => item.kategori)).size,
    stokHabis: list.filter((item) => Number(item.stok) <= 0).length,
  };
}

function isRemoteImage(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(url, { credentials: 'same-origin', ...options, headers });
  } catch {
    state.online = false;
    const error = new Error('Tidak dapat terhubung ke server. Periksa koneksi Anda.');
    error.status = 0;
    throw error;
  }

  state.online = true;
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const error = new Error(
      (data && data.error) || 'Permintaan gagal (status ' + response.status + ').'
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function showToast(message, type = 'success') {
  state.toast = { message, type };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = null;
    update();
  }, 4500);
}

function handleApiError(error) {
  if (error && error.status === 401) {
    state.user = null;
    state.activeTab = 'dashboard';
    state.isFormOpen = false;
    state.isSettingsOpen = false;
    state.loginError = 'Sesi Anda berakhir. Silakan masuk kembali.';
    update();
    return;
  }
  showToast(error?.message || 'Terjadi kesalahan.', 'error');
  update();
}

/* ------------------------------------------------------------------ */
/* Komponen tampilan                                                   */
/* ------------------------------------------------------------------ */

function renderVisual(value, className) {
  if (isRemoteImage(value)) {
    return `<img class="${className}" src="${escapeHtml(value)}" alt="" loading="lazy" />`;
  }
  return `<span class="card-emoji" aria-hidden="true">${escapeHtml(value || '☕')}</span>`;
}

function renderNavbar() {
  const initial = state.user ? state.user.username.slice(0, 1).toUpperCase() : '';
  return `
    <header class="navbar">
      <div class="container navbar-inner">
        <a href="#top" class="brand" data-nav="katalog">
          <span class="brand-icon" aria-hidden="true">☕</span>
          <div>
            <span class="brand-title">${escapeHtml(state.settings.store_name)}</span>
            <span class="brand-sub">${escapeHtml(state.settings.store_tagline)}</span>
          </div>
        </a>
        <div class="nav-right">
          <nav class="nav-tabs" aria-label="Navigasi Utama">
            <button
              type="button"
              class="nav-btn ${state.activeTab === 'katalog' ? 'active' : ''}"
              data-action="switch-tab"
              data-tab="katalog"
            >
              Katalog (${state.products.length})
            </button>
            <button
              type="button"
              class="nav-btn ${state.activeTab === 'dashboard' ? 'active' : ''}"
              data-action="switch-tab"
              data-tab="dashboard"
            >
              Dashboard Pengelola
            </button>
          </nav>
          ${
            state.user
              ? `<span class="user-chip"><span class="user-avatar">${escapeHtml(initial)}</span>${escapeHtml(
                  state.user.username
                )}</span>`
              : ''
          }
        </div>
      </div>
    </header>
  `;
}

function renderToast() {
  if (!state.toast) return '';
  return `
    <div class="toast toast-${escapeHtml(state.toast.type)}" role="status" aria-live="polite">
      <span>${escapeHtml(state.toast.message)}</span>
      <button type="button" class="toast-close" data-action="dismiss-toast" aria-label="Tutup notifikasi">×</button>
    </div>
  `;
}

function renderProductCard(produk) {
  const waUrl = buildWhatsAppUrl(produk);
  const outOfStock = Number(produk.stok) <= 0;
  const lowStock = Number(produk.stok) > 0 && Number(produk.stok) <= 5;

  let stockBadgeClass = 'stock-ok';
  let stockText = 'Stok: ' + produk.stok;
  if (outOfStock) {
    stockBadgeClass = 'stock-out';
    stockText = 'Stok Habis';
  } else if (lowStock) {
    stockBadgeClass = 'stock-low';
    stockText = 'Sisa ' + produk.stok;
  }

  return `
    <article class="product-card ${outOfStock ? 'is-out' : ''}">
      <div class="card-media">
        ${renderVisual(produk.imageUrl, 'card-image')}
        <div class="card-badges">
          <span class="badge-category">${escapeHtml(produk.kategori)}</span>
          ${produk.unggulan ? '<span class="badge-featured">★ Unggulan</span>' : ''}
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(produk.nama)}</h3>
        <p class="card-desc">${escapeHtml(produk.deskripsi || 'Produk pilihan ' + state.settings.store_name + '.')}</p>
        <div class="card-meta">
          <span class="card-price">${formatRupiah(produk.harga)}</span>
          <span class="stock-badge ${stockBadgeClass}">${stockText}</span>
        </div>
        <div class="card-actions">
          ${
            outOfStock
              ? '<button type="button" class="btn btn-wa btn-disabled" disabled>Stok Habis</button>'
              : !waUrl
                ? '<button type="button" class="btn btn-wa btn-disabled" disabled>Nomor WhatsApp Belum Diatur</button>'
                : `<a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-wa">💬 Pesan via WhatsApp</a>`
          }
        </div>
      </div>
    </article>
  `;
}

function renderCatalogView(filteredProducts, filters) {
  const categories = ['Semua', ...state.categories];
  const waHref = /^[1-9]\d{7,14}$/.test(normalizePhone(state.settings.whatsapp_number))
    ? 'https://wa.me/' + normalizePhone(state.settings.whatsapp_number)
    : null;

  return `
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <span class="hero-badge">🌿 ${escapeHtml(state.settings.store_hours)} · UMKM Lokal</span>
          <h1>Seduhan Terbaik untuk Mengawali Rejeki Hari Ini</h1>
          <p class="hero-desc">
            Pilihan biji kopi nusantara, bubuk tubruk warisan, minuman kopi susu siap saji, hingga paket hampers. Pesan langsung ke WhatsApp kedai tanpa antre.
          </p>
          <div class="hero-actions">
            <a href="#katalog" class="btn btn-primary">Lihat Katalog Kopi</a>
            <button type="button" class="btn btn-outline" data-action="switch-tab" data-tab="dashboard">
              ${state.user ? 'Buka Dashboard Pengelola' : 'Masuk Dashboard Pengelola'}
            </button>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-card-art">
            <div class="art-emoji-main">☕</div>
            <div class="art-pills">
              <span>🫘 Arabika &amp; Robusta</span>
              <span>🧊 Cold Brew &amp; Kopi Susu</span>
              <span>🎁 Hampers UMKM</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="katalog" class="catalog-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2>Katalog Produk ${escapeHtml(state.settings.store_name)}</h2>
            <p class="section-sub">Menampilkan ${filteredProducts.length} dari ${state.products.length} produk tersedia</p>
          </div>
        </div>

        <div class="controls-bar">
          <div class="search-box">
            <label for="search-input" class="sr-only">Cari produk kopi</label>
            <input
              id="search-input"
              type="search"
              placeholder="Cari nama kopi atau deskripsi (misal: Ijen, aren, tubruk)..."
              value="${escapeHtml(filters.query)}"
              data-input="query"
            />
          </div>
          <div class="sort-box">
            <label for="sort-select" class="sr-only">Urutkan produk</label>
            <select id="sort-select" data-change="sort">
              <option value="default" ${filters.sort === 'default' ? 'selected' : ''}>Urutkan: Rekomendasi</option>
              <option value="termurah" ${filters.sort === 'termurah' ? 'selected' : ''}>Harga: Termurah</option>
              <option value="termahal" ${filters.sort === 'termahal' ? 'selected' : ''}>Harga: Termahal</option>
              <option value="nama-asc" ${filters.sort === 'nama-asc' ? 'selected' : ''}>Nama: A – Z</option>
            </select>
          </div>
        </div>

        <div class="category-pills" role="group" aria-label="Filter Kategori">
          ${categories
            .map(
              (cat) => `
                <button
                  type="button"
                  class="pill-btn ${filters.kategori === cat ? 'active' : ''}"
                  data-action="filter-category"
                  data-category="${escapeHtml(cat)}"
                >
                  ${escapeHtml(cat)}
                </button>
              `
            )
            .join('')}
        </div>

        ${
          filteredProducts.length === 0
            ? `<div class="empty-state">
                <div class="empty-emoji" aria-hidden="true">🔍</div>
                <h3>Produk kopi tidak ditemukan</h3>
                <p>Coba ubah kata kunci pencarian atau pilih kategori lain untuk melihat koleksi kopi kami.</p>
                <button type="button" class="btn btn-primary" data-action="reset-filters">Reset Pencarian &amp; Filter</button>
              </div>`
            : `<div class="product-grid">${filteredProducts.map((p) => renderProductCard(p)).join('')}</div>`
        }
      </div>
    </section>

    <footer class="footer">
      <div class="container footer-inner">
        <div>
          <strong>☕ ${escapeHtml(state.settings.store_name)}</strong> · ${escapeHtml(state.settings.store_tagline)}
        </div>
        <div class="footer-links">
          <span>${escapeHtml(state.settings.store_address)}</span>
          <span>${escapeHtml(state.settings.store_hours)}</span>
          ${
            waHref
              ? `<a href="${escapeHtml(waHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                  formatPhoneDisplay(state.settings.whatsapp_number)
                )}</a>`
              : ''
          }
          <span class="connection-badge">
            <span class="connection-dot ${state.online ? '' : 'offline'}"></span>
            Database SQLite ${state.online ? 'terhubung' : 'terputus'}
          </span>
        </div>
      </div>
    </footer>
  `;
}

function renderLoginView() {
  return `
    <section class="dashboard-section">
      <div class="container">
        <div class="login-wrap">
          <div class="login-card">
            <div class="login-emoji" aria-hidden="true">🔐</div>
            <h2>Masuk Dashboard Pengelola</h2>
            <p class="login-hint">
              Area khusus pemilik toko untuk mengelola produk, stok, harga, dan pengaturan WhatsApp.
            </p>
            ${
              state.loginError
                ? `<div class="form-errors" role="alert">${escapeHtml(state.loginError)}</div>`
                : ''
            }
            <form id="login-form" novalidate>
              <div class="form-group">
                <label for="login-username">Username</label>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autocomplete="username"
                  required
                  placeholder="Masukkan username"
                  value="${escapeHtml(state.loginUsername)}"
                  data-input="login-username"
                />
              </div>
              <div class="form-group">
                <label for="login-password">Password</label>
                <div class="password-wrap">
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    required
                    placeholder="Masukkan password"
                  />
                  <button type="button" class="password-toggle" data-action="toggle-password">Lihat</button>
                </div>
              </div>
              <button type="submit" class="btn btn-primary btn-block" ${state.busy ? 'disabled' : ''}>
                ${state.busy ? 'Memproses…' : 'Masuk ke Dashboard'}
              </button>
            </form>
            <p class="form-hint" style="text-align: center; margin-top: 14px">
              Belum punya akses? Hubungi pemilik toko untuk dibuatkan akun pengelola.
            </p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderProductForm() {
  const isEdit = Boolean(state.editingProduct);
  const data =
    state.formDraft ||
    (isEdit
      ? state.editingProduct
      : {
          nama: '',
          kategori: state.categories[0] || FALLBACK_CATEGORIES[0],
          harga: '',
          stok: '',
          deskripsi: '',
          imageUrl: '☕',
          unggulan: false,
        });

  return `
    <div class="form-card" id="product-form-panel">
      <div class="form-card-header">
        <h3>${isEdit ? 'Edit Produk Kopi' : 'Tambah Produk Baru'}</h3>
        <button type="button" class="btn-close-form" data-action="close-form" aria-label="Tutup form">×</button>
      </div>
      ${
        state.formErrors.length > 0
          ? `<div class="form-errors" role="alert">
              <strong>Periksa kembali input Anda:</strong>
              <ul>${state.formErrors.map((err) => `<li>${escapeHtml(err)}</li>`).join('')}</ul>
            </div>`
          : ''
      }
      <form id="product-form" novalidate>
        ${isEdit ? `<input type="hidden" name="id" value="${escapeHtml(data.id)}" />` : ''}
        <div class="form-grid">
          <div class="form-group">
            <label for="field-nama">Nama Produk *</label>
            <input id="field-nama" name="nama" type="text" required placeholder="Contoh: Arabika Gayo Honey 250g" value="${escapeHtml(data.nama)}" />
          </div>
          <div class="form-group">
            <label for="field-kategori">Kategori *</label>
            <select id="field-kategori" name="kategori">
              ${state.categories
                .map(
                  (cat) =>
                    `<option value="${escapeHtml(cat)}" ${data.kategori === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="field-harga">Harga (Rupiah) *</label>
            <input id="field-harga" name="harga" type="number" min="0" step="500" required placeholder="Contoh: 55000" value="${escapeHtml(data.harga)}" />
          </div>
          <div class="form-group">
            <label for="field-stok">Stok (Unit) *</label>
            <input id="field-stok" name="stok" type="number" min="0" step="1" required placeholder="Contoh: 20" value="${escapeHtml(data.stok)}" />
          </div>
          <div class="form-group">
            <label for="field-emoji">Ikon / URL Gambar</label>
            <input
              id="field-emoji"
              name="imageUrl"
              type="text"
              list="emoji-suggestions"
              maxlength="200"
              placeholder="Emoji atau URL https://..."
              value="${escapeHtml(data.imageUrl || '☕')}"
            />
            <datalist id="emoji-suggestions">
              ${state.emojis
                .map((em) => `<option value="${escapeHtml(em)}"></option>`)
                .join('')}
            </datalist>
            <span class="form-hint">Pilih emoji dari daftar atau tempel URL gambar (harus diawali http/https).</span>
          </div>
          <div class="form-group form-checkbox-wrap">
            <label class="checkbox-label">
              <input type="checkbox" name="unggulan" ${data.unggulan ? 'checked' : ''} />
              <span>Tandai sebagai Produk Unggulan (★)</span>
            </label>
          </div>
        </div>
        <div class="form-group">
          <label for="field-deskripsi">Deskripsi Singkat</label>
          <textarea id="field-deskripsi" name="deskripsi" rows="3" placeholder="Jelaskan profil rasa, berat bersih, atau saran penyajian...">${escapeHtml(data.deskripsi)}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${isEdit ? 'Simpan Perubahan' : 'Simpan Produk'}</button>
          <button type="button" class="btn btn-outline" data-action="close-form">Batal</button>
        </div>
      </form>
    </div>
  `;
}

function renderSettingsForm() {
  const data = state.settingsDraft || state.settings;
  return `
    <div class="form-card" id="settings-panel">
      <div class="form-card-header">
        <h3>Pengaturan Toko</h3>
        <button type="button" class="btn-close-form" data-action="close-settings" aria-label="Tutup pengaturan">×</button>
      </div>
      <div class="settings-note">
        Nomor WhatsApp ini dipakai oleh semua tombol pemesanan pada katalog. Data langsung tersimpan di database.
      </div>
      ${
        state.settingsErrors.length > 0
          ? `<div class="form-errors" role="alert">
              <strong>Periksa kembali input Anda:</strong>
              <ul>${state.settingsErrors.map((err) => `<li>${escapeHtml(err)}</li>`).join('')}</ul>
            </div>`
          : ''
      }
      <form id="settings-form" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label for="setting-name">Nama Toko *</label>
            <input id="setting-name" name="store_name" type="text" required value="${escapeHtml(data.store_name)}" />
          </div>
          <div class="form-group">
            <label for="setting-tagline">Tagline</label>
            <input id="setting-tagline" name="store_tagline" type="text" value="${escapeHtml(data.store_tagline)}" />
          </div>
          <div class="form-group">
            <label for="setting-wa">Nomor WhatsApp *</label>
            <input id="setting-wa" name="whatsapp_number" type="tel" required placeholder="Contoh: 081234567890" value="${escapeHtml(data.whatsapp_number)}" />
            <span class="form-hint">Format bebas: 08xx, 62xx, atau +62. Akan dinormalisasi otomatis.</span>
          </div>
          <div class="form-group">
            <label for="setting-hours">Jam Operasional</label>
            <input id="setting-hours" name="store_hours" type="text" value="${escapeHtml(data.store_hours)}" />
          </div>
        </div>
        <div class="form-group">
          <label for="setting-address">Alamat Toko</label>
          <input id="setting-address" name="store_address" type="text" value="${escapeHtml(data.store_address)}" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan Pengaturan</button>
          <button type="button" class="btn btn-outline" data-action="close-settings">Batal</button>
        </div>
      </form>
    </div>
  `;
}

function renderDashboardView(stats) {
  return `
    <section class="dashboard-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2>Dashboard Pengelolaan Produk</h2>
            <p class="section-sub">Kelola katalog, harga, stok, dan pengaturan toko ${escapeHtml(state.settings.store_name)}</p>
          </div>
          <div class="dashboard-toolbar">
            <button type="button" class="btn btn-primary" data-action="open-create">+ Tambah Produk</button>
            <button type="button" class="btn btn-outline" data-action="open-settings">⚙ Pengaturan Toko</button>
            <button type="button" class="btn btn-outline" data-action="export-json">⬇ Export JSON</button>
            <label class="btn btn-outline">
              ⬆ Import JSON
              <input type="file" accept=".json,application/json" data-change="import-json" hidden />
            </label>
            <button type="button" class="btn btn-outline" data-action="refresh-data">↻ Muat Ulang</button>
            <button type="button" class="btn btn-danger-outline" data-action="logout">Keluar</button>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Total Produk</span>
            <strong class="stat-value">${stats.totalProduk}</strong>
            <span class="stat-hint">Varian terdaftar di katalog</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Stok Tersedia</span>
            <strong class="stat-value">${stats.totalStok}</strong>
            <span class="stat-hint">Unit siap dipesan pelanggan</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Kategori Aktif</span>
            <strong class="stat-value">${stats.kategoriAktif}</strong>
            <span class="stat-hint">Dari ${state.categories.length} kategori tersedia</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Stok Habis</span>
            <strong class="stat-value">${stats.stokHabis}</strong>
            <span class="stat-hint">Produk perlu segera diisi ulang</span>
          </div>
        </div>

        ${state.isSettingsOpen ? renderSettingsForm() : ''}
        ${state.isFormOpen ? renderProductForm() : ''}

        <div class="table-card">
          <div class="table-responsive">
            <table class="product-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>Harga</th>
                  <th>Stok</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${
                  state.products.length === 0
                    ? '<tr><td colspan="6" class="table-empty">Belum ada produk. Klik "+ Tambah Produk" untuk memulai.</td></tr>'
                    : state.products
                        .map((p) => {
                          const stok = Number(p.stok);
                          const stokClass = stok <= 0 ? 'status-out' : stok <= 5 ? 'status-low' : 'status-ok';
                          const visual = isRemoteImage(p.imageUrl)
                            ? `<img src="${escapeHtml(p.imageUrl)}" alt="" loading="lazy" />`
                            : `<span class="table-emoji" aria-hidden="true">${escapeHtml(p.imageUrl || '☕')}</span>`;
                          return `
                            <tr>
                              <td>
                                <div class="table-prod">
                                  ${visual}
                                  <div>
                                    <strong>${escapeHtml(p.nama)}</strong>
                                    <div class="table-desc">${escapeHtml(p.deskripsi)}</div>
                                  </div>
                                </div>
                              </td>
                              <td><span class="badge-category">${escapeHtml(p.kategori)}</span></td>
                              <td class="nowrap">${formatRupiah(p.harga)}</td>
                              <td class="nowrap"><span class="${stokClass}">${stok}</span></td>
                              <td class="nowrap">${p.unggulan ? '<span class="badge-featured">★ Unggulan</span>' : '<span class="muted-text">Reguler</span>'}</td>
                              <td class="nowrap">
                                <div class="table-actions">
                                  <button type="button" class="btn-sm btn-edit" data-action="edit-product" data-id="${escapeHtml(p.id)}">Edit</button>
                                  <button type="button" class="btn-sm btn-delete" data-action="delete-product" data-id="${escapeHtml(p.id)}">Hapus</button>
                                </div>
                              </td>
                            </tr>
                          `;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderLoadingView() {
  return `
    <div class="loading-state">
      <div class="spinner" aria-hidden="true"></div>
      <p>Memuat data Toko Kopi Rejeki…</p>
    </div>
  `;
}

function renderErrorView() {
  return `
    <div class="container error-state">
      <div class="empty-emoji" aria-hidden="true">⚠️</div>
      <h2>Tidak dapat memuat data</h2>
      <p>${escapeHtml(state.loadError || 'Terjadi kesalahan saat menghubungi server.')}</p>
      <button type="button" class="btn btn-primary" data-action="retry-load">Coba Lagi</button>
    </div>
  `;
}

function render() {
  if (state.loading) {
    appContainer.innerHTML = renderLoadingView();
    return;
  }

  if (state.loadError && state.products.length === 0) {
    appContainer.innerHTML = renderErrorView();
    return;
  }

  const filteredProducts = filterProducts(state.products, state.filters);
  const stats = getDashboardStats(state.products);

  appContainer.innerHTML = `
    ${renderNavbar()}
    ${renderToast()}
    <main id="top">
      ${
        state.activeTab === 'katalog'
          ? renderCatalogView(filteredProducts, state.filters)
          : state.user
            ? renderDashboardView(stats)
            : renderLoginView()
      }
    </main>
  `;
}

function update() {
  const activeEl = document.activeElement;
  const activeId = activeEl && activeEl.id ? activeEl.id : null;
  const selectionStart =
    activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;

  render();

  if (activeId) {
    const nextEl = document.getElementById(activeId);
    if (nextEl) {
      nextEl.focus();
      if (selectionStart !== null && typeof nextEl.setSelectionRange === 'function') {
        try {
          nextEl.setSelectionRange(selectionStart, selectionStart);
        } catch {}
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Muat data & aksi                                                    */
/* ------------------------------------------------------------------ */

async function loadMeta() {
  try {
    const meta = await apiFetch('/api/meta');
    if (Array.isArray(meta.categories) && meta.categories.length > 0) {
      state.categories = meta.categories;
    }
    if (Array.isArray(meta.emojis) && meta.emojis.length > 0) {
      state.emojis = meta.emojis;
    }
  } catch {}
}

async function bootstrap() {
  state.loading = true;
  state.loadError = '';
  update();

  try {
    const [me, productsRes, settingsRes] = await Promise.all([
      apiFetch('/api/auth/me'),
      apiFetch('/api/products'),
      apiFetch('/api/settings'),
    ]);

    state.user = me.authenticated ? me.user : null;
    state.products = productsRes.products || [];
    state.settings = { ...DEFAULT_SETTINGS, ...(settingsRes.settings || {}) };
    await loadMeta();
    if (
      state.filters.kategori !== 'Semua' &&
      !state.categories.includes(state.filters.kategori)
    ) {
      state.filters.kategori = 'Semua';
    }
  } catch (error) {
    state.loadError = error?.message || 'Gagal memuat data.';
  } finally {
    state.loading = false;
    update();
  }
}

async function refreshData(silent = false) {
  try {
    const [productsRes, settingsRes] = await Promise.all([
      apiFetch('/api/products'),
      apiFetch('/api/settings'),
    ]);
    state.products = productsRes.products || [];
    state.settings = { ...DEFAULT_SETTINGS, ...(settingsRes.settings || {}) };
    state.loadError = '';
    if (!silent) {
      showToast('Data terbaru berhasil dimuat.', 'success');
    }
    update();
  } catch (error) {
    state.loadError = error?.message || 'Gagal memuat data.';
    handleApiError(error);
  }
}

async function login(username, password) {
  state.busy = true;
  state.loginError = '';
  update();

  try {
    const result = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    state.user = result.user;
    state.loginUsername = result.user.username;
    state.loginError = '';
    state.busy = false;
    await refreshData(true);
    showToast('Selamat datang, ' + result.user.username + '!', 'success');
    update();
  } catch (error) {
    state.busy = false;
    state.loginError = error?.message || 'Gagal masuk.';
    showToast(state.loginError, 'error');
    update();
  }
}

async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {}
  state.user = null;
  state.isFormOpen = false;
  state.isSettingsOpen = false;
  state.editingProduct = null;
  state.formDraft = null;
  state.formErrors = [];
  state.settingsDraft = null;
  state.settingsErrors = [];
  state.loginError = '';
  state.activeTab = 'dashboard';
  showToast('Anda telah keluar dari dashboard.', 'success');
  update();
}

async function saveProduct(data) {
  try {
    if (state.editingProduct) {
      const result = await apiFetch('/api/products/' + encodeURIComponent(state.editingProduct.id), {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      state.products = state.products.map((p) =>
        p.id === state.editingProduct.id ? result.product : p
      );
      showToast('Produk "' + result.product.nama + '" berhasil diperbarui.', 'success');
    } else {
      const result = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      state.products = [result.product, ...state.products];
      showToast('Produk "' + result.product.nama + '" ditambahkan ke katalog.', 'success');
    }
    state.isFormOpen = false;
    state.editingProduct = null;
    state.formDraft = null;
    state.formErrors = [];
    update();
  } catch (error) {
    if (error.status === 401) {
      handleApiError(error);
      return;
    }
    state.formDraft = data;
    state.formErrors =
      (error.data && Array.isArray(error.data.errors) && error.data.errors) || [
        error?.message || 'Gagal menyimpan produk.',
      ];
    showToast(state.formErrors[0], 'error');
    update();
  }
}

async function deleteProduct(id) {
  const found = state.products.find((p) => p.id === id);
  if (!found) return;
  if (!window.confirm('Hapus produk "' + found.nama + '" dari katalog?')) return;

  try {
    await apiFetch('/api/products/' + encodeURIComponent(id), { method: 'DELETE' });
    state.products = state.products.filter((p) => p.id !== id);
    if (state.editingProduct && state.editingProduct.id === id) {
      state.isFormOpen = false;
      state.editingProduct = null;
      state.formDraft = null;
    }
    showToast('Produk "' + found.nama + '" berhasil dihapus.', 'success');
    update();
  } catch (error) {
    handleApiError(error);
  }
}

async function saveSettings(data) {
  try {
    const result = await apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    state.settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
    state.isSettingsOpen = false;
    state.settingsDraft = null;
    state.settingsErrors = [];
    showToast('Pengaturan toko berhasil disimpan.', 'success');
    update();
  } catch (error) {
    if (error.status === 401) {
      handleApiError(error);
      return;
    }
    state.settingsDraft = data;
    state.settingsErrors =
      (error.data && Array.isArray(error.data.errors) && error.data.errors) || [
        error?.message || 'Gagal menyimpan pengaturan.',
      ];
    showToast(state.settingsErrors[0], 'error');
    update();
  }
}

async function exportJson() {
  try {
    const response = await fetch('/api/products/export', { credentials: 'same-origin' });
    if (response.status === 401) {
      const error = new Error('Sesi Anda berakhir. Silakan masuk kembali.');
      error.status = 401;
      throw error;
    }
    if (!response.ok) {
      throw new Error('Gagal mengekspor data produk.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toko-kopi-rejeki-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Data produk berhasil diekspor ke JSON.', 'success');
    update();
  } catch (error) {
    handleApiError(error);
  }
}

async function importJson(file) {
  try {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('File bukan JSON yang valid.');
    }
    const list = Array.isArray(parsed) ? parsed : parsed && parsed.products;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error('JSON harus berisi array produk yang tidak kosong.');
    }

    const result = await apiFetch('/api/products/import', {
      method: 'POST',
      body: JSON.stringify(list),
    });
    state.products = result.products || [];
    state.filters.kategori = 'Semua';
    state.isFormOpen = false;
    state.editingProduct = null;
    state.formDraft = null;
    showToast('Berhasil mengimpor ' + state.products.length + ' produk.', 'success');
    update();
  } catch (error) {
    handleApiError(error);
  }
}

/* ------------------------------------------------------------------ */
/* Event listener                                                      */
/* ------------------------------------------------------------------ */

appContainer.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action], [data-nav]');
  if (!target) return;

  if (target.dataset.nav === 'katalog') {
    state.activeTab = 'katalog';
    update();
    return;
  }

  const action = target.dataset.action;

  if (action === 'switch-tab') {
    state.activeTab = target.dataset.tab === 'dashboard' ? 'dashboard' : 'katalog';
    state.formErrors = [];
    state.settingsErrors = [];
    state.loginError = '';
    update();
  } else if (action === 'filter-category') {
    state.filters.kategori = target.dataset.category || 'Semua';
    update();
  } else if (action === 'reset-filters') {
    state.filters = { query: '', kategori: 'Semua', sort: 'default' };
    update();
  } else if (action === 'dismiss-toast') {
    state.toast = null;
    update();
  } else if (action === 'toggle-password') {
    const input = document.getElementById('login-password');
    if (input) {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      target.textContent = show ? 'Sembunyi' : 'Lihat';
      input.focus();
    }
  } else if (action === 'open-create') {
    state.isFormOpen = true;
    state.editingProduct = null;
    state.formDraft = null;
    state.formErrors = [];
    state.isSettingsOpen = false;
    update();
    document.getElementById('product-form-panel')?.scrollIntoView({ behavior: 'smooth' });
  } else if (action === 'close-form') {
    state.isFormOpen = false;
    state.editingProduct = null;
    state.formDraft = null;
    state.formErrors = [];
    update();
  } else if (action === 'edit-product') {
    const found = state.products.find((p) => p.id === target.dataset.id);
    if (found) {
      state.isFormOpen = true;
      state.editingProduct = { ...found };
      state.formDraft = null;
      state.formErrors = [];
      state.isSettingsOpen = false;
      update();
      document.getElementById('product-form-panel')?.scrollIntoView({ behavior: 'smooth' });
    }
  } else if (action === 'delete-product') {
    deleteProduct(target.dataset.id);
  } else if (action === 'open-settings') {
    state.isSettingsOpen = true;
    state.settingsDraft = null;
    state.settingsErrors = [];
    state.isFormOpen = false;
    update();
    document.getElementById('settings-panel')?.scrollIntoView({ behavior: 'smooth' });
  } else if (action === 'close-settings') {
    state.isSettingsOpen = false;
    state.settingsDraft = null;
    state.settingsErrors = [];
    update();
  } else if (action === 'export-json') {
    exportJson();
  } else if (action === 'refresh-data') {
    refreshData();
  } else if (action === 'logout') {
    logout();
  } else if (action === 'retry-load') {
    bootstrap();
  }
});

appContainer.addEventListener('input', (event) => {
  const target = event.target;
  if (target.dataset.input === 'query') {
    state.filters.query = target.value;
    update();
  } else if (target.dataset.input === 'login-username') {
    state.loginUsername = target.value;
  }
});

appContainer.addEventListener('change', (event) => {
  const target = event.target;
  if (target.dataset.change === 'sort') {
    state.filters.sort = target.value;
    update();
    return;
  }
  if (target.dataset.change === 'import-json') {
    const file = target.files && target.files[0];
    if (!file) return;
    importJson(file).finally(() => {
      target.value = '';
    });
  }
});

appContainer.addEventListener('submit', (event) => {
  if (event.target.id === 'login-form') {
    event.preventDefault();
    const formData = new FormData(event.target);
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '');
    state.loginUsername = username;
    if (!username || !password) {
      state.loginError = 'Username dan password wajib diisi.';
      update();
      return;
    }
    login(username, password);
    return;
  }

  if (event.target.id === 'product-form') {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = {
      nama: formData.get('nama'),
      kategori: formData.get('kategori'),
      harga: formData.get('harga'),
      stok: formData.get('stok'),
      deskripsi: formData.get('deskripsi'),
      imageUrl: formData.get('imageUrl') || '☕',
      unggulan: formData.get('unggulan') === 'on',
    };
    if (state.editingProduct) data.id = state.editingProduct.id;
    saveProduct(data);
    return;
  }

  if (event.target.id === 'settings-form') {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = {
      store_name: formData.get('store_name'),
      store_tagline: formData.get('store_tagline'),
      whatsapp_number: formData.get('whatsapp_number'),
      store_address: formData.get('store_address'),
      store_hours: formData.get('store_hours'),
    };
    saveSettings(data);
  }
});

bootstrap();

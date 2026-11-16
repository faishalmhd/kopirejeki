import {
  buildWhatsAppUrl,
  calculateCartTotals,
  escapeHtml,
  filterProducts,
  formatRupiah,
  PRESET_IMAGES,
  VALID_CATEGORIES,
} from './store.js';

const ORDER_STATUSES = ['Menunggu Konfirmasi', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'];

export function renderApp(container, state) {
  const {
    activeView,
    backendMode,
    currentUser,
    products,
    filters,
    cart,
    isCartOpen,
    shippingMethod,
    selectedProductDetail,
    orders,
    adminUsers,
    isFormOpen,
    editingProduct,
    formPreviewUrl,
    formErrors,
    authMode,
    authForm,
    authError,
    toast,
  } = state;

  const filteredProducts = filterProducts(products, filters);
  const cartTotals = calculateCartTotals(cart, shippingMethod);

  const roleLabels = {
    admin: 'Admin Platform',
    seller: 'Seller UMKM',
    pembeli: 'Pembeli',
  };

  container.innerHTML = `
    <header class="navbar">
      <div class="container navbar-inner">
        <a href="#top" class="brand" data-action="go-home">
          <img src="./images/products/arabika-ijen.jpg" alt="Logo Toko Kopi Rejeki" class="brand-thumb" />
          <div>
            <span class="brand-title">Toko Kopi Rejeki</span>
            <span class="brand-sub">Marketplace &amp; Roastery UMKM Nusantara</span>
          </div>
        </a>

        <nav class="nav-tabs" aria-label="Menu Utama">
          <button
            type="button"
            class="nav-btn ${activeView === 'katalog' ? 'active' : ''}"
            data-action="switch-view"
            data-view="katalog"
          >
            Katalog
          </button>

          ${
            currentUser
              ? `<button
                  type="button"
                  class="nav-btn ${activeView === 'orders' ? 'active' : ''}"
                  data-action="switch-view"
                  data-view="orders"
                >
                  Pesanan (${orders.length})
                </button>`
              : ''
          }

          ${
            currentUser && (currentUser.role === 'seller' || currentUser.role === 'admin')
              ? `<button
                  type="button"
                  class="nav-btn ${activeView === 'seller' ? 'active' : ''}"
                  data-action="switch-view"
                  data-view="seller"
                >
                  Dashboard Seller
                </button>`
              : ''
          }

          ${
            currentUser && currentUser.role === 'admin'
              ? `<button
                  type="button"
                  class="nav-btn ${activeView === 'admin' ? 'active' : ''}"
                  data-action="switch-view"
                  data-view="admin"
                >
                  Panel Admin
                </button>`
              : ''
          }
        </nav>

        <div class="nav-actions">
          <button type="button" class="cart-trigger" data-action="toggle-cart" aria-label="Keranjang Belanja">
            <span>Keranjang</span>
            <span class="cart-badge">${cartTotals.itemCount}</span>
          </button>

          ${
            currentUser
              ? `<div class="user-pill">
                  <div class="user-meta">
                    <span class="user-name">${escapeHtml(currentUser.name)}</span>
                    <span class="role-tag role-${escapeHtml(currentUser.role)}">${escapeHtml(roleLabels[currentUser.role] || currentUser.role)}</span>
                  </div>
                  <button type="button" class="btn-logout" data-action="logout">Keluar</button>
                </div>`
              : `<button
                  type="button"
                  class="btn btn-primary btn-sm-pad ${activeView === 'auth' ? 'active' : ''}"
                  data-action="switch-view"
                  data-view="auth"
                >
                  Masuk / Daftar
                </button>`
          }
        </div>
      </div>
    </header>

    ${
      backendMode === 'fallback'
        ? `<div class="mode-strip">
            <div class="container">
              <strong>Mode Preview Statis Aktif:</strong> Backend Express tidak terdeteksi pada host ini, sehingga autentikasi multi-role, keranjang, dan database berjalan menggunakan penyimpanan lokal terisolasi. Jalankan <code>npm run dev</code> di lokal untuk mengaktifkan server Node.js + SQLite penuh.
            </div>
          </div>`
        : ''
    }

    ${
      toast
        ? `<div class="toast toast-${escapeHtml(toast.type)}" role="status" aria-live="polite">
            <span>${escapeHtml(toast.message)}</span>
            <button type="button" class="toast-close" data-action="dismiss-toast" aria-label="Tutup notifikasi">×</button>
          </div>`
        : ''
    }

    <main id="top">
      ${
        activeView === 'auth'
          ? renderAuthView(authMode, authForm, authError)
          : activeView === 'orders'
            ? renderOrdersView(currentUser, orders)
            : activeView === 'seller'
              ? renderSellerDashboard(currentUser, products, orders, isFormOpen, editingProduct, formPreviewUrl, formErrors)
              : activeView === 'admin'
                ? renderAdminPanel(currentUser, products, orders, adminUsers)
                : renderCatalogView(filteredProducts, products, filters, currentUser)
      }
    </main>

    ${isCartOpen ? renderCartDrawer(cart, cartTotals, shippingMethod, currentUser) : ''}
    ${selectedProductDetail ? renderProductDetailModal(selectedProductDetail, currentUser) : ''}

    <footer class="footer">
      <div class="container footer-inner">
        <div>
          <strong>Toko Kopi Rejeki</strong> · Platform E-Commerce Katalog &amp; Roastery UMKM Nusantara
        </div>
        <p class="footer-note">
          Arsitektur Production: Multi-Role RBAC (Admin · Seller · Pembeli) · Validasi Server &amp; Proteksi XSS
        </p>
      </div>
    </footer>
  `;
}

function renderAuthView(authMode, authForm, authError) {
  const isRegister = authMode === 'register';

  return `
    <section class="auth-section">
      <div class="container auth-grid">
        <div class="auth-showcase">
          <span class="hero-badge">Akses Multi-Peran Terintegrasi</span>
          <h1>Satu Platform untuk Pecinta Kopi &amp; Mitra Roastery UMKM</h1>
          <p>
            Masuk sebagai <strong>Pembeli</strong> untuk memesan kopi pilihan dan memberi ulasan, sebagai <strong>Seller UMKM</strong> untuk mengelola katalog &amp; pesanan toko Anda, atau sebagai <strong>Admin</strong> untuk mengelola ekosistem platform.
          </p>

          <div class="demo-accounts-box">
            <h3>1-Klik Isi Akun Demo (Password: <code>Password123!</code>)</h3>
            <div class="demo-btn-grid">
              <button type="button" class="demo-fill-btn" data-action="fill-demo" data-email="pembeli@kopirejeki.id">
                <strong>Pembeli</strong>
                <span>pembeli@kopirejeki.id</span>
              </button>
              <button type="button" class="demo-fill-btn" data-action="fill-demo" data-email="seller@kopirejeki.id">
                <strong>Seller 1 (Kopi Rejeki)</strong>
                <span>seller@kopirejeki.id</span>
              </button>
              <button type="button" class="demo-fill-btn" data-action="fill-demo" data-email="ijenroastery@kopirejeki.id">
                <strong>Seller 2 (Ijen Highland)</strong>
                <span>ijenroastery@kopirejeki.id</span>
              </button>
              <button type="button" class="demo-fill-btn" data-action="fill-demo" data-email="admin@kopirejeki.id">
                <strong>Admin Platform</strong>
                <span>admin@kopirejeki.id</span>
              </button>
            </div>
          </div>
        </div>

        <div class="auth-card">
          <div class="auth-tabs">
            <button
              type="button"
              class="auth-tab ${!isRegister ? 'active' : ''}"
              data-action="set-auth-mode"
              data-mode="login"
            >
              Masuk Akun
            </button>
            <button
              type="button"
              class="auth-tab ${isRegister ? 'active' : ''}"
              data-action="set-auth-mode"
              data-mode="register"
            >
              Daftar Baru
            </button>
          </div>

          ${
            authError
              ? `<div class="form-errors" role="alert">${escapeHtml(authError)}</div>`
              : ''
          }

          ${
            !isRegister
              ? `<form id="login-form" class="stacked-form">
                  <div class="form-group">
                    <label for="login-email">Alamat Email</label>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      required
                      placeholder="nama@email.com"
                      value="${escapeHtml(authForm.email)}"
                    />
                  </div>
                  <div class="form-group">
                    <label for="login-password">Kata Sandi</label>
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      required
                      placeholder="Masukkan kata sandi"
                      value="${escapeHtml(authForm.password)}"
                    />
                  </div>
                  <button type="submit" class="btn btn-primary btn-full">Masuk Sekarang</button>
                </form>`
              : `<form id="register-form" class="stacked-form">
                  <div class="form-group">
                    <label for="reg-role">Daftar Sebagai</label>
                    <select id="reg-role" name="role" data-change="reg-role">
                      <option value="pembeli" ${authForm.role === 'pembeli' ? 'selected' : ''}>Pembeli (Pelanggan Kopi)</option>
                      <option value="seller" ${authForm.role === 'seller' ? 'selected' : ''}>Seller (Mitra UMKM / Roastery)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="reg-name">Nama Lengkap *</label>
                    <input id="reg-name" name="name" type="text" required placeholder="Contoh: Rina Marlina" value="${escapeHtml(authForm.name)}" />
                  </div>
                  <div class="form-group">
                    <label for="reg-email">Alamat Email *</label>
                    <input id="reg-email" name="email" type="email" required placeholder="rina@contoh.com" value="${escapeHtml(authForm.email)}" />
                  </div>
                  ${
                    authForm.role === 'seller'
                      ? `<div class="form-group">
                          <label for="reg-shop">Nama Toko / Roastery UMKM *</label>
                          <input id="reg-shop" name="shopName" type="text" required placeholder="Contoh: Kedai Kopi Kalipuro" value="${escapeHtml(authForm.shopName)}" />
                        </div>`
                      : ''
                  }
                  <div class="form-group">
                    <label for="reg-wa">Nomor WhatsApp (Format 628...)</label>
                    <input id="reg-wa" name="whatsapp" type="tel" placeholder="6281234567890" value="${escapeHtml(authForm.whatsapp)}" />
                  </div>
                  <div class="form-group">
                    <label for="reg-address">Alamat Lengkap</label>
                    <input id="reg-address" name="address" type="text" placeholder="Jl. Merdeka No. 12, Banyuwangi" value="${escapeHtml(authForm.address)}" />
                  </div>
                  <div class="form-group">
                    <label for="reg-password">Kata Sandi (Minimal 8 Karakter) *</label>
                    <input id="reg-password" name="password" type="password" required minlength="8" placeholder="Minimal 8 karakter" />
                  </div>
                  <button type="submit" class="btn btn-primary btn-full">Buat Akun Sekarang</button>
                </form>`
          }
        </div>
      </div>
    </section>
  `;
}

function renderCatalogView(filteredProducts, allProducts, filters, currentUser) {
  const categories = ['Semua', ...VALID_CATEGORIES];
  const sellerCount = new Set(allProducts.map((p) => p.seller_id)).size;

  return `
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <span class="hero-badge">Sangrai Segar Setiap Pekan · Direct From UMKM</span>
          <h1>Seduhan Terbaik untuk Mengawali Rejeki Hari Ini</h1>
          <p class="hero-desc">
            Jelajahi biji kopi single-origin, bubuk tubruk warisan, minuman kopi susu siap saji, hingga paket hampers dari mitra roastery lokal pilihan. Checkout langsung di aplikasi atau pesan cepat via WhatsApp.
          </p>
          <div class="hero-actions">
            <a href="#katalog" class="btn btn-primary">Jelajahi Katalog (${allProducts.length})</a>
            ${
              !currentUser
                ? `<button type="button" class="btn btn-outline" data-action="switch-view" data-view="auth">
                    Masuk / Daftar Mitra
                  </button>`
                : ''
            }
          </div>
          <div class="hero-metrics">
            <div><strong>${allProducts.length}</strong><span>Varian Produk</span></div>
            <div><strong>${sellerCount}</strong><span>Mitra Roastery</span></div>
            <div><strong>100%</strong><span>Kopi Lokal Terkurasi</span></div>
          </div>
        </div>

        <div class="hero-gallery">
          <div class="hero-photo-main">
            <img src="./images/products/arabika-ijen.jpg" alt="Arabika Ijen Natural 250g" />
            <div class="hero-photo-caption">
              <span class="badge-featured">★ Terlaris Pekan Ini</span>
              <strong>Arabika Ijen Natural 250g</strong>
              <span>Roasting segar lereng Gunung Ijen</span>
            </div>
          </div>
          <div class="hero-photo-stack">
            <img src="./images/products/es-kopi-susu.jpg" alt="Es Kopi Susu Gula Aren" />
            <img src="./images/products/hampers-pagi.jpg" alt="Paket Hampers Ngopi Pagi" />
          </div>
        </div>
      </div>
    </section>

    <section id="katalog" class="catalog-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2>Katalog Produk Kopi &amp; Minuman</h2>
            <p class="section-sub">Menampilkan ${filteredProducts.length} dari ${allProducts.length} produk tersedia</p>
          </div>
        </div>

        <div class="controls-bar">
          <div class="search-box">
            <label for="search-input" class="sr-only">Cari produk kopi</label>
            <input
              id="search-input"
              type="search"
              placeholder="Cari nama kopi, rasa, atau nama toko roastery..."
              value="${escapeHtml(filters.query)}"
              data-input="query"
            />
          </div>

          <div class="sort-box">
            <label for="sort-select" class="sr-only">Urutkan produk</label>
            <select id="sort-select" data-change="sort">
              <option value="default" ${filters.sort === 'default' ? 'selected' : ''}>Urutkan: Rekomendasi</option>
              <option value="rating" ${filters.sort === 'rating' ? 'selected' : ''}>Rating Tertinggi</option>
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
                <h3>Produk kopi tidak ditemukan</h3>
                <p>Coba ubah kata kunci pencarian atau pilih kategori lain untuk melihat koleksi kopi kami.</p>
                <button type="button" class="btn btn-primary" data-action="reset-filters">Reset Pencarian &amp; Filter</button>
              </div>`
            : `<div class="product-grid">${filteredProducts.map((p) => renderProductCard(p)).join('')}</div>`
        }
      </div>
    </section>
  `;
}

function renderProductCard(produk) {
  const waUrl = buildWhatsAppUrl(produk.seller_whatsapp, produk);
  const outOfStock = produk.stok <= 0 || !waUrl;
  const lowStock = produk.stok > 0 && produk.stok <= 5;
  const imgSrc = produk.imageUrl || produk.image_url || './images/products/arabika-ijen.jpg';

  let stockBadgeClass = 'stock-ok';
  let stockText = `Stok: ${produk.stok}`;
  if (outOfStock) {
    stockBadgeClass = 'stock-out';
    stockText = 'Stok Habis';
  } else if (lowStock) {
    stockBadgeClass = 'stock-low';
    stockText = `Sisa ${produk.stok}`;
  }

  return `
    <article class="product-card ${outOfStock ? 'is-out' : ''}">
      <div class="card-media" data-action="open-detail" data-id="${escapeHtml(produk.id)}" role="button" tabindex="0">
        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(produk.nama)}" class="card-photo" loading="lazy" />
        <div class="card-badges">
          <span class="badge-category">${escapeHtml(produk.kategori)}</span>
          ${produk.unggulan ? '<span class="badge-featured">★ Unggulan</span>' : ''}
        </div>
      </div>

      <div class="card-body">
        <div class="card-shop-row">
          <span class="shop-label">${escapeHtml(produk.shop_name || 'Toko Kopi Rejeki')}</span>
          <span class="rating-pill">★ ${Number(produk.avg_rating) > 0 ? escapeHtml(produk.avg_rating) : 'Baru'} (${produk.review_count || 0})</span>
        </div>

        <h3 class="card-title">
          <button type="button" class="title-link" data-action="open-detail" data-id="${escapeHtml(produk.id)}">
            ${escapeHtml(produk.nama)}
          </button>
        </h3>
        <p class="card-desc">${escapeHtml(produk.deskripsi || 'Produk pilihan Toko Kopi Rejeki.')}</p>

        <div class="card-meta">
          <span class="card-price">${formatRupiah(produk.harga)}</span>
          <span class="stock-badge ${stockBadgeClass}">${stockText}</span>
        </div>

        <div class="card-actions-dual">
          ${
            outOfStock
              ? '<button type="button" class="btn btn-disabled btn-full" disabled>Stok Habis</button>'
              : `<button type="button" class="btn btn-primary" data-action="add-to-cart" data-id="${escapeHtml(produk.id)}">
                  + Keranjang
                </button>
                <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-wa-icon" title="Pesan Langsung via WhatsApp">
                  WhatsApp
                </a>`
          }
        </div>
      </div>
    </article>
  `;
}

function renderCartDrawer(cart, totals, shippingMethod, currentUser) {
  return `
    <div class="drawer-backdrop" data-action="close-cart">
      <aside class="cart-drawer" role="dialog" aria-label="Keranjang Belanja" onclick="event.stopPropagation()">
        <div class="drawer-header">
          <h3>Keranjang Belanja (${totals.itemCount})</h3>
          <button type="button" class="btn-close-form" data-action="close-cart" aria-label="Tutup keranjang">×</button>
        </div>

        <div class="drawer-body">
          ${
            cart.length === 0
              ? `<div class="empty-cart">
                  <p>Keranjang belanja Anda masih kosong.</p>
                  <button type="button" class="btn btn-primary" data-action="close-cart">Pilih Kopi Sekarang</button>
                </div>`
              : `<div class="cart-items-list">
                  ${cart
                    .map(
                      (item) => `
                      <div class="cart-item">
                        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.nama)}" class="cart-item-img" />
                        <div class="cart-item-info">
                          <strong>${escapeHtml(item.nama)}</strong>
                          <span class="cart-item-price">${formatRupiah(item.harga)}</span>
                          <div class="qty-controls">
                            <button type="button" data-action="cart-dec" data-id="${escapeHtml(item.id)}">−</button>
                            <span>${item.quantity}</span>
                            <button type="button" data-action="cart-inc" data-id="${escapeHtml(item.id)}">+</button>
                            <button type="button" class="cart-remove" data-action="cart-remove" data-id="${escapeHtml(item.id)}">Hapus</button>
                          </div>
                        </div>
                      </div>
                    `
                    )
                    .join('')}
                </div>

                <form id="checkout-form" class="checkout-box">
                  <h4>Detail Pengiriman &amp; Checkout</h4>
                  <div class="form-group">
                    <label for="shipping-method">Metode Pengiriman</label>
                    <select id="shipping-method" name="shippingMethod" data-change="shipping-method">
                      <option value="Kurir Lokal Banyuwangi" ${shippingMethod === 'Kurir Lokal Banyuwangi' ? 'selected' : ''}>Kurir Lokal Banyuwangi (Rp 10.000)</option>
                      <option value="Ekspedisi Reguler" ${shippingMethod === 'Ekspedisi Reguler' ? 'selected' : ''}>Ekspedisi Reguler Nasional (Rp 18.000)</option>
                      <option value="Ambil di Kedai" ${shippingMethod === 'Ambil di Kedai' ? 'selected' : ''}>Ambil Langsung di Kedai (Gratis)</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="shipping-address">Alamat Lengkap / Lokasi Ambil *</label>
                    <textarea id="shipping-address" name="shippingAddress" rows="2" required placeholder="Masukkan alamat lengkap pengiriman...">${escapeHtml(currentUser?.address || '')}</textarea>
                  </div>

                  <div class="form-group">
                    <label for="order-notes">Catatan Pesanan (Gilingan / Es / Gula)</label>
                    <input id="order-notes" name="notes" type="text" placeholder="Contoh: Giling medium untuk V60" />
                  </div>

                  <div class="totals-summary">
                    <div><span>Subtotal Produk</span><span>${formatRupiah(totals.subtotal)}</span></div>
                    <div><span>Ongkos Kirim</span><span>${formatRupiah(totals.shippingCost)}</span></div>
                    <div class="total-grand"><span>Total Bayar</span><strong>${formatRupiah(totals.total)}</strong></div>
                  </div>

                  ${
                    currentUser
                      ? `<button type="submit" class="btn btn-primary btn-full">Buat Pesanan Sekarang</button>`
                      : `<button type="button" class="btn btn-primary btn-full" data-action="login-to-checkout">
                          Masuk untuk Melanjutkan Checkout
                        </button>`
                  }
                </form>`
          }
        </div>
      </aside>
    </div>
  `;
}

function renderProductDetailModal(detail, currentUser) {
  const { product, reviews } = detail;
  const imgSrc = product.imageUrl || product.image_url || './images/products/arabika-ijen.jpg';
  const waUrl = buildWhatsAppUrl(product.seller_whatsapp, product);

  return `
    <div class="modal-backdrop" data-action="close-detail">
      <div class="detail-modal" role="dialog" aria-label="Detail Produk" onclick="event.stopPropagation()">
        <button type="button" class="modal-close-btn" data-action="close-detail" aria-label="Tutup detail">×</button>
        <div class="detail-grid">
          <div class="detail-photo-wrap">
            <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.nama)}" />
          </div>
          <div class="detail-content">
            <div class="detail-badges">
              <span class="badge-category">${escapeHtml(product.kategori)}</span>
              ${product.unggulan ? '<span class="badge-featured">★ Unggulan</span>' : ''}
            </div>
            <h2>${escapeHtml(product.nama)}</h2>
            <p class="detail-shop">Penjual: <strong>${escapeHtml(product.shop_name || 'Toko Kopi Rejeki')}</strong> · ★ ${Number(product.avg_rating) > 0 ? escapeHtml(product.avg_rating) : 'Belum ada rating'} (${reviews.length} ulasan)</p>
            <div class="detail-price-row">
              <strong class="detail-price">${formatRupiah(product.harga)}</strong>
              <span class="stock-badge ${product.stok > 0 ? 'stock-ok' : 'stock-out'}">
                ${product.stok > 0 ? `Tersedia ${product.stok} unit` : 'Stok Habis'}
              </span>
            </div>
            <p class="detail-desc">${escapeHtml(product.deskripsi)}</p>

            <div class="detail-actions">
              ${
                product.stok > 0
                  ? `<button type="button" class="btn btn-primary" data-action="add-to-cart" data-id="${escapeHtml(product.id)}">
                      + Tambah ke Keranjang
                    </button>
                    <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-wa-outline">
                      Tanya / Pesan via WhatsApp
                    </a>`
                  : '<button type="button" class="btn btn-disabled" disabled>Stok Habis</button>'
              }
            </div>
          </div>
        </div>

        <div class="reviews-section">
          <h3>Ulasan Pelanggan (${reviews.length})</h3>
          ${
            currentUser && (currentUser.role === 'pembeli' || currentUser.role === 'admin')
              ? `<form id="review-form" class="review-form" data-product-id="${escapeHtml(product.id)}">
                  <div class="review-form-row">
                    <select name="rating" aria-label="Pilih Rating Bintang">
                      <option value="5">★★★★★ (5 - Sangat Puas)</option>
                      <option value="4">★★★★☆ (4 - Puas)</option>
                      <option value="3">★★★☆☆ (3 - Cukup)</option>
                      <option value="2">★★☆☆☆ (2 - Kurang)</option>
                      <option value="1">★☆☆☆☆ (1 - Mengecewakan)</option>
                    </select>
                    <input name="comment" type="text" required placeholder="Tulis pengalaman Anda menyeduh produk ini..." />
                    <button type="submit" class="btn btn-primary">Kirim Ulasan</button>
                  </div>
                </form>`
              : `<p class="muted-text">Masuk sebagai <strong>Pembeli</strong> untuk menulis ulasan produk.</p>`
          }

          <div class="reviews-list">
            ${
              reviews.length === 0
                ? '<p class="muted-text">Belum ada ulasan untuk produk ini.</p>'
                : reviews
                    .map(
                      (r) => `
                      <div class="review-item">
                        <div class="review-head">
                          <strong>${escapeHtml(r.buyer_name)}</strong>
                          <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                        </div>
                        <p>${escapeHtml(r.comment)}</p>
                      </div>
                    `
                    )
                    .join('')
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderOrdersView(currentUser, orders) {
  if (!currentUser) return '';

  return `
    <section class="dashboard-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2>Riwayat &amp; Status Pesanan</h2>
            <p class="section-sub">Pantau transaksi pesanan Anda secara real-time</p>
          </div>
        </div>

        ${
          orders.length === 0
            ? `<div class="empty-state">
                <h3>Belum ada riwayat pesanan</h3>
                <p>Mulai jelajahi katalog kopi kami dan buat pesanan pertama Anda.</p>
                <button type="button" class="btn btn-primary" data-action="switch-view" data-view="katalog">Ke Katalog Kopi</button>
              </div>`
            : `<div class="orders-list">
                ${orders
                  .map(
                    (o) => `
                    <article class="order-card">
                      <div class="order-head">
                        <div>
                          <strong>${escapeHtml(o.id)}</strong>
                          <span class="order-date"> · ${new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <div class="order-buyer">Pemesan: ${escapeHtml(o.buyer_name)} · ${escapeHtml(o.shipping_method)}</div>
                        </div>
                        <span class="status-pill status-${escapeHtml(o.status.toLowerCase().replace(/\s+/g, '-'))}">
                          ${escapeHtml(o.status)}
                        </span>
                      </div>
                      <div class="order-items-body">
                        ${(o.items || [])
                          .map(
                            (it) => `
                            <div class="order-line">
                              <span>${escapeHtml(it.product_name)} × ${it.quantity}</span>
                              <span>${formatRupiah(it.price * it.quantity)}</span>
                            </div>
                          `
                          )
                          .join('')}
                      </div>
                      <div class="order-foot">
                        <span class="muted-text">Alamat: ${escapeHtml(o.shipping_address)}</span>
                        <strong>Total: ${formatRupiah(o.total_amount)}</strong>
                      </div>
                    </article>
                  `
                  )
                  .join('')}
              </div>`
        }
      </div>
    </section>
  `;
}

function renderSellerDashboard(currentUser, allProducts, orders, isFormOpen, editingProduct, formPreviewUrl, formErrors) {
  if (!currentUser || !['seller', 'admin'].includes(currentUser.role)) return '';

  const myProducts =
    currentUser.role === 'admin'
      ? allProducts
      : allProducts.filter((p) => p.seller_id === currentUser.id);

  const totalStok = myProducts.reduce((s, p) => s + (Number(p.stok) || 0), 0);
  const completedRevenue = orders
    .filter((o) => o.status !== 'Dibatalkan')
    .reduce((s, o) => s + (o.items || []).reduce((sub, it) => sub + it.price * it.quantity, 0), 0);

  return `
    <section class="dashboard-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2>Dashboard Seller · ${escapeHtml(currentUser.shop_name || currentUser.name)}</h2>
            <p class="section-sub">Kelola katalog produk, foto kemasan, stok, dan pesanan masuk toko Anda</p>
          </div>
          <div class="dashboard-toolbar">
            <button type="button" class="btn btn-primary" data-action="open-create">+ Tambah Produk</button>
            <button type="button" class="btn btn-outline" data-action="export-json">⬇ Export JSON</button>
            <label class="btn btn-outline">
              ⬆ Import JSON
              <input type="file" accept=".json,application/json" data-change="import-json" hidden />
            </label>
          </div>
        </div>

        <div class="stats-grid stats-4">
          <div class="stat-card">
            <span class="stat-label">Produk Toko</span>
            <strong class="stat-value">${myProducts.length}</strong>
            <span class="stat-hint">Varian aktif di etalase</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Stok</span>
            <strong class="stat-value">${totalStok}</strong>
            <span class="stat-hint">Unit siap kirim</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Pesanan Masuk</span>
            <strong class="stat-value">${orders.length}</strong>
            <span class="stat-hint">Transaksi pelanggan</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Estimasi Omzet</span>
            <strong class="stat-value stat-money">${formatRupiah(completedRevenue)}</strong>
            <span class="stat-hint">Pesanan aktif &amp; selesai</span>
          </div>
        </div>

        ${isFormOpen ? renderProductForm(editingProduct, formPreviewUrl, formErrors) : ''}

        <h3 class="sub-heading">Daftar Produk Toko</h3>
        <div class="table-card">
          <div class="table-responsive">
            <table class="product-table">
              <thead>
                <tr>
                  <th>Foto &amp; Nama Produk</th>
                  <th>Kategori</th>
                  <th>Harga</th>
                  <th>Stok</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${
                  myProducts.length === 0
                    ? '<tr><td colspan="6" class="table-empty">Belum ada produk di toko Anda. Klik "+ Tambah Produk".</td></tr>'
                    : myProducts
                        .map(
                          (p) => `
                          <tr>
                            <td>
                              <div class="table-prod">
                                <img src="${escapeHtml(p.imageUrl || p.image_url)}" alt="${escapeHtml(p.nama)}" class="table-thumb" />
                                <div>
                                  <strong>${escapeHtml(p.nama)}</strong>
                                  <div class="table-desc">${escapeHtml(p.deskripsi)}</div>
                                </div>
                              </div>
                            </td>
                            <td><span class="badge-category">${escapeHtml(p.kategori)}</span></td>
                            <td class="nowrap">${formatRupiah(p.harga)}</td>
                            <td class="nowrap"><strong>${p.stok}</strong></td>
                            <td class="nowrap">${p.unggulan ? '<span class="badge-featured">★ Unggulan</span>' : '<span class="muted-text">Reguler</span>'}</td>
                            <td class="nowrap">
                              <div class="table-actions">
                                <button type="button" class="btn-sm btn-edit" data-action="edit-product" data-id="${escapeHtml(p.id)}">Edit</button>
                                <button type="button" class="btn-sm btn-delete" data-action="delete-product" data-id="${escapeHtml(p.id)}">Hapus</button>
                              </div>
                            </td>
                          </tr>
                        `
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <h3 class="sub-heading" style="margin-top: 28px;">Kelola Pesanan Masuk (${orders.length})</h3>
        <div class="table-card">
          <div class="table-responsive">
            <table class="product-table">
              <thead>
                <tr>
                  <th>ID Order</th>
                  <th>Pembeli &amp; Alamat</th>
                  <th>Item Dipesan</th>
                  <th>Status Pesanan</th>
                </tr>
              </thead>
              <tbody>
                ${
                  orders.length === 0
                    ? '<tr><td colspan="4" class="table-empty">Belum ada pesanan masuk.</td></tr>'
                    : orders
                        .map(
                          (o) => `
                          <tr>
                            <td class="nowrap"><strong>${escapeHtml(o.id)}</strong></td>
                            <td>
                              <strong>${escapeHtml(o.buyer_name)}</strong>
                              <div class="table-desc">${escapeHtml(o.shipping_method)} · ${escapeHtml(o.shipping_address)}</div>
                            </td>
                            <td>
                              ${(o.items || []).map((it) => `<div>${escapeHtml(it.product_name)} (×${it.quantity})</div>`).join('')}
                            </td>
                            <td class="nowrap">
                              <select class="status-select" data-change="order-status" data-order-id="${escapeHtml(o.id)}">
                                ${ORDER_STATUSES.map(
                                  (st) => `<option value="${st}" ${o.status === st ? 'selected' : ''}>${st}</option>`
                                ).join('')}
                              </select>
                            </td>
                          </tr>
                        `
                        )
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

function renderProductForm(editingProduct, formPreviewUrl, formErrors) {
  const isEdit = Boolean(editingProduct);
  const data = editingProduct || {
    nama: '',
    kategori: VALID_CATEGORIES[0],
    harga: '',
    stok: '',
    deskripsi: '',
    imageUrl: PRESET_IMAGES[0].url,
    unggulan: false,
  };
  const currentImg = formPreviewUrl || data.imageUrl || data.image_url || PRESET_IMAGES[0].url;

  return `
    <div class="form-card" id="product-form-panel">
      <div class="form-card-header">
        <h3>${isEdit ? 'Edit Produk Kopi' : 'Tambah Produk Kopi Baru'}</h3>
        <button type="button" class="btn-close-form" data-action="close-form" aria-label="Tutup form">×</button>
      </div>

      ${
        formErrors && formErrors.length > 0
          ? `<div class="form-errors" role="alert">
              <ul>${formErrors.map((err) => `<li>${escapeHtml(err)}</li>`).join('')}</ul>
            </div>`
          : ''
      }

      <form id="product-form" novalidate>
        ${isEdit ? `<input type="hidden" name="id" value="${escapeHtml(data.id)}" />` : ''}
        <input type="hidden" id="field-image-url" name="imageUrl" value="${escapeHtml(currentImg)}" />

        <div class="form-photo-row">
          <img src="${escapeHtml(currentImg)}" alt="Preview Foto Produk" class="form-photo-preview" />
          <div class="form-photo-controls">
            <label class="btn btn-outline">
              📷 Upload Foto Produk (JPG/PNG/WEBP)
              <input type="file" accept="image/png,image/jpeg,image/webp" data-change="upload-product-photo" hidden />
            </label>
            <div class="form-group" style="margin-top: 8px;">
              <label for="preset-select">Atau Pilih Foto Kemasan Studio Bawaan:</label>
              <select id="preset-select" data-change="preset-image">
                ${PRESET_IMAGES.map(
                  (img) => `<option value="${escapeHtml(img.url)}" ${currentImg === img.url ? 'selected' : ''}>${escapeHtml(img.label)}</option>`
                ).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="field-nama">Nama Produk *</label>
            <input id="field-nama" name="nama" type="text" required placeholder="Contoh: Arabika Gayo Honey 250g" value="${escapeHtml(data.nama)}" />
          </div>
          <div class="form-group">
            <label for="field-kategori">Kategori *</label>
            <select id="field-kategori" name="kategori">
              ${VALID_CATEGORIES.map((cat) => `<option value="${escapeHtml(cat)}" ${data.kategori === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="field-harga">Harga (Rupiah) *</label>
            <input id="field-harga" name="harga" type="number" min="0" step="500" required placeholder="Contoh: 65000" value="${escapeHtml(data.harga)}" />
          </div>
          <div class="form-group">
            <label for="field-stok">Stok (Unit) *</label>
            <input id="field-stok" name="stok" type="number" min="0" step="1" required placeholder="Contoh: 20" value="${escapeHtml(data.stok)}" />
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" name="unggulan" ${data.unggulan ? 'checked' : ''} />
            <span>Tandai sebagai Produk Unggulan (★)</span>
          </label>
        </div>

        <div class="form-group">
          <label for="field-deskripsi">Deskripsi Produk</label>
          <textarea id="field-deskripsi" name="deskripsi" rows="3" placeholder="Jelaskan asal biji, proses sangrai, profil rasa, dan berat bersih...">${escapeHtml(data.deskripsi)}</textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${isEdit ? 'Simpan Perubahan' : 'Publikasikan Produk'}</button>
          <button type="button" class="btn btn-outline" data-action="close-form">Batal</button>
        </div>
      </form>
    </div>
  `;
}

function renderAdminPanel(currentUser, products, orders, adminUsers) {
  if (!currentUser || currentUser.role !== 'admin') return '';

  const totalGross = orders
    .filter((o) => o.status !== 'Dibatalkan')
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  return `
    <section class="dashboard-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2>Panel Administrator Platform</h2>
            <p class="section-sub">Kelola seluruh pengguna (Admin, Seller, Pembeli), moderasi produk lintas toko, dan pantau transaksi global</p>
          </div>
        </div>

        <div class="stats-grid stats-4">
          <div class="stat-card">
            <span class="stat-label">Total Pengguna</span>
            <strong class="stat-value">${adminUsers.length}</strong>
            <span class="stat-hint">Admin, Seller &amp; Pembeli</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Produk Katalog</span>
            <strong class="stat-value">${products.length}</strong>
            <span class="stat-hint">Lintas seluruh mitra UMKM</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Transaksi</span>
            <strong class="stat-value">${orders.length}</strong>
            <span class="stat-hint">Pesanan tercatat di sistem</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Volume Transaksi (GMV)</span>
            <strong class="stat-value stat-money">${formatRupiah(totalGross)}</strong>
            <span class="stat-hint">Total nilai pesanan aktif</span>
          </div>
        </div>

        <h3 class="sub-heading">Manajemen Pengguna &amp; Hak Akses (RBAC)</h3>
        <div class="table-card">
          <div class="table-responsive">
            <table class="product-table">
              <thead>
                <tr>
                  <th>Nama &amp; Email</th>
                  <th>Toko / Alamat</th>
                  <th>Peran (Role)</th>
                  <th>Status Akun</th>
                </tr>
              </thead>
              <tbody>
                ${adminUsers
                  .map(
                    (u) => `
                    <tr>
                      <td>
                        <strong>${escapeHtml(u.name)}</strong>
                        <div class="table-desc">${escapeHtml(u.email)}</div>
                      </td>
                      <td>
                        <div>${escapeHtml(u.shop_name || '—')}</div>
                        <div class="table-desc">${escapeHtml(u.address || '')}</div>
                      </td>
                      <td class="nowrap">
                        <select
                          class="status-select"
                          data-change="admin-user-role"
                          data-user-id="${escapeHtml(u.id)}"
                          ${u.id === currentUser.id ? 'disabled' : ''}
                        >
                          <option value="pembeli" ${u.role === 'pembeli' ? 'selected' : ''}>pembeli</option>
                          <option value="seller" ${u.role === 'seller' ? 'selected' : ''}>seller</option>
                          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                        </select>
                      </td>
                      <td class="nowrap">
                        <button
                          type="button"
                          class="btn-sm ${u.is_active ? 'btn-edit' : 'btn-delete'}"
                          data-action="toggle-user-active"
                          data-user-id="${escapeHtml(u.id)}"
                          data-active="${u.is_active ? '1' : '0'}"
                          ${u.id === currentUser.id ? 'disabled' : ''}
                        >
                          ${u.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <h3 class="sub-heading" style="margin-top: 28px;">Moderasi Semua Produk Lintas Toko (${products.length})</h3>
        <div class="table-card">
          <div class="table-responsive">
            <table class="product-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Toko / Seller</th>
                  <th>Harga &amp; Stok</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${products
                  .map(
                    (p) => `
                    <tr>
                      <td>
                        <div class="table-prod">
                          <img src="${escapeHtml(p.imageUrl || p.image_url)}" alt="${escapeHtml(p.nama)}" class="table-thumb" />
                          <div>
                            <strong>${escapeHtml(p.nama)}</strong>
                            <div class="table-desc">${escapeHtml(p.kategori)}</div>
                          </div>
                        </div>
                      </td>
                      <td>${escapeHtml(p.shop_name || 'Mitra UMKM')}</td>
                      <td class="nowrap">${formatRupiah(p.harga)} · Stok: <strong>${p.stok}</strong></td>
                      <td class="nowrap">
                        <button type="button" class="btn-sm btn-delete" data-action="delete-product" data-id="${escapeHtml(p.id)}">
                          Hapus Produk
                        </button>
                      </td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;
}

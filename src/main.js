import './style.css';
import {
  apiBulkImportProducts,
  apiCreateOrder,
  apiCreateProduct,
  apiDeleteProduct,
  apiGetAdminUsers,
  apiGetMe,
  apiGetOrders,
  apiGetProductDetail,
  apiGetProducts,
  apiLogin,
  apiLogout,
  apiRegister,
  apiSubmitReview,
  apiUpdateAdminUser,
  apiUpdateOrderStatus,
  apiUpdateProduct,
  apiUploadImage,
  detectBackendMode,
} from './api.js';
import { PRESET_IMAGES } from './store.js';
import { renderApp } from './ui.js';

const appContainer = document.getElementById('app');

const state = {
  activeView: 'katalog',
  backendMode: 'checking',
  currentUser: null,
  products: [],
  filters: {
    query: '',
    kategori: 'Semua',
    sort: 'default',
  },
  cart: [],
  isCartOpen: false,
  shippingMethod: 'Kurir Lokal Banyuwangi',
  selectedProductDetail: null,
  orders: [],
  adminUsers: [],
  isFormOpen: false,
  editingProduct: null,
  formPreviewUrl: PRESET_IMAGES[0].url,
  formErrors: [],
  authMode: 'login',
  authForm: {
    role: 'pembeli',
    name: '',
    email: 'pembeli@kopirejeki.id',
    password: 'Password123!',
    shopName: '',
    whatsapp: '',
    address: '',
  },
  authError: '',
  toast: null,
};

let toastTimer = null;

function showToast(message, type = 'success') {
  state.toast = { message, type };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = null;
    update();
  }, 4500);
}

function update() {
  const activeEl = document.activeElement;
  const activeId = activeEl ? activeEl.id : null;
  const selectionStart = activeEl && 'selectionStart' in activeEl ? activeEl.selectionStart : null;

  renderApp(appContainer, state);

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

async function refreshAllData() {
  state.products = await apiGetProducts();
  if (state.currentUser) {
    state.orders = await apiGetOrders();
    if (state.currentUser.role === 'admin') {
      state.adminUsers = await apiGetAdminUsers();
    }
  } else {
    state.orders = [];
    state.adminUsers = [];
  }
}

async function bootstrap() {
  state.backendMode = await detectBackendMode();
  state.currentUser = await apiGetMe();
  await refreshAllData();
  update();
}

appContainer.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  try {
    if (action === 'go-home') {
      event.preventDefault();
      state.activeView = 'katalog';
      update();
    } else if (action === 'switch-view') {
      const nextView = target.dataset.view || 'katalog';
      if (['orders', 'seller', 'admin'].includes(nextView) && !state.currentUser) {
        state.activeView = 'auth';
        showToast('Silakan login terlebih dahulu.', 'warning');
        update();
        return;
      }
      state.activeView = nextView;
      state.authError = '';
      state.formErrors = [];
      update();
    } else if (action === 'set-auth-mode') {
      state.authMode = target.dataset.mode === 'register' ? 'register' : 'login';
      state.authError = '';
      if (state.authMode === 'register') {
        state.authForm = {
          role: 'pembeli',
          name: '',
          email: '',
          password: '',
          shopName: '',
          whatsapp: '',
          address: '',
        };
      }
      update();
    } else if (action === 'fill-demo') {
      state.authMode = 'login';
      state.authForm.email = target.dataset.email || '';
      state.authForm.password = 'Password123!';
      state.authError = '';
      update();
    } else if (action === 'logout') {
      await apiLogout();
      state.currentUser = null;
      state.orders = [];
      state.adminUsers = [];
      state.activeView = 'katalog';
      showToast('Anda telah keluar dari akun.', 'success');
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
    } else if (action === 'toggle-cart') {
      state.isCartOpen = !state.isCartOpen;
      update();
    } else if (action === 'close-cart') {
      state.isCartOpen = false;
      update();
    } else if (action === 'login-to-checkout') {
      state.isCartOpen = false;
      state.activeView = 'auth';
      state.authMode = 'login';
      showToast('Silakan masuk sebagai Pembeli untuk menyelesaikan pesanan.', 'warning');
      update();
    } else if (action === 'add-to-cart') {
      const prod = state.products.find((p) => p.id === target.dataset.id);
      if (!prod || prod.stok <= 0) return;

      const existing = state.cart.find((c) => c.id === prod.id);
      if (existing) {
        if (existing.quantity >= prod.stok) {
          showToast(`Maksimal pembelian sesuai stok tersedia (${prod.stok}).`, 'warning');
          update();
          return;
        }
        existing.quantity += 1;
      } else {
        state.cart.push({
          id: prod.id,
          nama: prod.nama,
          harga: prod.harga,
          stok: prod.stok,
          imageUrl: prod.imageUrl || prod.image_url,
          quantity: 1,
        });
      }
      showToast(`"${prod.nama}" ditambahkan ke keranjang.`, 'success');
      update();
    } else if (action === 'cart-inc') {
      const item = state.cart.find((c) => c.id === target.dataset.id);
      const prod = state.products.find((p) => p.id === target.dataset.id);
      if (item && prod && item.quantity < prod.stok) {
        item.quantity += 1;
        update();
      }
    } else if (action === 'cart-dec') {
      const item = state.cart.find((c) => c.id === target.dataset.id);
      if (item) {
        if (item.quantity > 1) item.quantity -= 1;
        else state.cart = state.cart.filter((c) => c.id !== item.id);
        update();
      }
    } else if (action === 'cart-remove') {
      state.cart = state.cart.filter((c) => c.id !== target.dataset.id);
      update();
    } else if (action === 'open-detail') {
      const detail = await apiGetProductDetail(target.dataset.id);
      state.selectedProductDetail = detail;
      update();
    } else if (action === 'close-detail') {
      state.selectedProductDetail = null;
      update();
    } else if (action === 'open-create') {
      state.isFormOpen = true;
      state.editingProduct = null;
      state.formPreviewUrl = PRESET_IMAGES[0].url;
      state.formErrors = [];
      update();
    } else if (action === 'close-form') {
      state.isFormOpen = false;
      state.editingProduct = null;
      state.formErrors = [];
      update();
    } else if (action === 'edit-product') {
      const found = state.products.find((p) => p.id === target.dataset.id);
      if (found) {
        state.isFormOpen = true;
        state.editingProduct = { ...found };
        state.formPreviewUrl = found.imageUrl || found.image_url || PRESET_IMAGES[0].url;
        state.formErrors = [];
        update();
        document.getElementById('product-form-panel')?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (action === 'delete-product') {
      const found = state.products.find((p) => p.id === target.dataset.id);
      if (!found) return;
      if (!window.confirm(`Hapus produk "${found.nama}" dari katalog?`)) return;
      await apiDeleteProduct(found.id);
      await refreshAllData();
      showToast(`Produk "${found.nama}" berhasil dihapus.`, 'success');
      update();
    } else if (action === 'export-json') {
      const myProducts =
        state.currentUser?.role === 'admin'
          ? state.products
          : state.products.filter((p) => p.seller_id === state.currentUser?.id);
      const blob = new Blob([JSON.stringify(myProducts, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `katalog-kopi-rejeki-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Data produk berhasil di-export ke JSON.', 'success');
      update();
    } else if (action === 'toggle-user-active') {
      const userId = target.dataset.userId;
      const isCurrentlyActive = target.dataset.active === '1';
      await apiUpdateAdminUser(userId, { is_active: !isCurrentlyActive });
      await refreshAllData();
      showToast('Status akun pengguna diperbarui.', 'success');
      update();
    }
  } catch (err) {
    showToast(err.message || 'Terjadi kesalahan.', 'error');
    update();
  }
});

appContainer.addEventListener('input', (event) => {
  const target = event.target;
  if (target.dataset.input === 'query') {
    state.filters.query = target.value;
    update();
  }
});

appContainer.addEventListener('change', async (event) => {
  const target = event.target;

  try {
    if (target.dataset.change === 'sort') {
      state.filters.sort = target.value;
      update();
    } else if (target.dataset.change === 'reg-role') {
      state.authForm.role = target.value;
      update();
    } else if (target.dataset.change === 'shipping-method') {
      state.shippingMethod = target.value;
      update();
    } else if (target.dataset.change === 'preset-image') {
      state.formPreviewUrl = target.value;
      update();
    } else if (target.dataset.change === 'upload-product-photo') {
      const file = target.files && target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const uploadedUrl = await apiUploadImage(file.name, String(reader.result));
          state.formPreviewUrl = uploadedUrl;
          showToast('Foto produk berhasil diunggah.', 'success');
          update();
        } catch (err) {
          showToast(err.message, 'error');
          update();
        }
      };
      reader.readAsDataURL(file);
    } else if (target.dataset.change === 'import-json') {
      const file = target.files && target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const count = await apiBulkImportProducts(String(reader.result || ''));
          await refreshAllData();
          showToast(`Berhasil mengimpor ${count} produk baru.`, 'success');
          update();
        } catch (err) {
          showToast(`Impor ditolak: ${err.message}`, 'error');
          update();
        }
      };
      reader.readAsText(file);
      target.value = '';
    } else if (target.dataset.change === 'order-status') {
      await apiUpdateOrderStatus(target.dataset.orderId, target.value);
      await refreshAllData();
      showToast('Status pesanan berhasil diperbarui.', 'success');
      update();
    } else if (target.dataset.change === 'admin-user-role') {
      await apiUpdateAdminUser(target.dataset.userId, { role: target.value });
      await refreshAllData();
      showToast('Peran pengguna berhasil diubah.', 'success');
      update();
    }
  } catch (err) {
    showToast(err.message, 'error');
    update();
  }
});

appContainer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;

  try {
    if (form.id === 'login-form') {
      const fd = new FormData(form);
      const email = String(fd.get('email') || '');
      const password = String(fd.get('password') || '');
      state.authForm.email = email;
      state.authForm.password = password;

      const user = await apiLogin(email, password);
      state.currentUser = user;
      state.authError = '';
      await refreshAllData();

      state.activeView =
        user.role === 'admin' ? 'admin' : user.role === 'seller' ? 'seller' : 'katalog';
      showToast(`Selamat datang kembali, ${user.name}!`, 'success');
      update();
    } else if (form.id === 'register-form') {
      const fd = new FormData(form);
      const payload = {
        role: String(fd.get('role') || 'pembeli'),
        name: String(fd.get('name') || ''),
        email: String(fd.get('email') || ''),
        shopName: String(fd.get('shopName') || ''),
        whatsapp: String(fd.get('whatsapp') || ''),
        address: String(fd.get('address') || ''),
        password: String(fd.get('password') || ''),
      };
      state.authForm = { ...state.authForm, ...payload };

      const user = await apiRegister(payload);
      state.currentUser = user;
      state.authError = '';
      await refreshAllData();

      state.activeView = user.role === 'seller' ? 'seller' : 'katalog';
      showToast(`Pendaftaran berhasil! Selamat datang, ${user.name}.`, 'success');
      update();
    } else if (form.id === 'product-form') {
      const fd = new FormData(form);
      const payload = {
        nama: fd.get('nama'),
        kategori: fd.get('kategori'),
        harga: fd.get('harga'),
        stok: fd.get('stok'),
        deskripsi: fd.get('deskripsi'),
        imageUrl: state.formPreviewUrl || fd.get('imageUrl'),
        unggulan: fd.get('unggulan') === 'on',
      };

      if (state.editingProduct) {
        await apiUpdateProduct(state.editingProduct.id, payload);
        showToast(`Produk "${payload.nama}" berhasil diperbarui.`, 'success');
      } else {
        await apiCreateProduct(payload);
        showToast(`Produk "${payload.nama}" berhasil ditambahkan.`, 'success');
      }

      await refreshAllData();
      state.isFormOpen = false;
      state.editingProduct = null;
      state.formErrors = [];
      update();
    } else if (form.id === 'checkout-form') {
      const fd = new FormData(form);
      const res = await apiCreateOrder({
        items: state.cart.map((c) => ({ productId: c.id, quantity: c.quantity })),
        shippingMethod: String(fd.get('shippingMethod') || state.shippingMethod),
        shippingAddress: String(fd.get('shippingAddress') || ''),
        notes: String(fd.get('notes') || ''),
      });

      state.cart = [];
      state.isCartOpen = false;
      await refreshAllData();
      state.activeView = 'orders';
      showToast(`Pesanan ${res.orderId} berhasil dibuat!`, 'success');
      update();
    } else if (form.id === 'review-form') {
      const productId = form.dataset.productId;
      const fd = new FormData(form);
      await apiSubmitReview(productId, Number(fd.get('rating')), String(fd.get('comment') || ''));
      state.selectedProductDetail = await apiGetProductDetail(productId);
      await refreshAllData();
      showToast('Terima kasih! Ulasan Anda telah dipublikasikan.', 'success');
      update();
    }
  } catch (err) {
    if (form.id === 'login-form' || form.id === 'register-form') {
      state.authError = err.message;
    } else if (form.id === 'product-form') {
      state.formErrors = [err.message];
    } else {
      showToast(err.message, 'error');
    }
    update();
  }
});

bootstrap();

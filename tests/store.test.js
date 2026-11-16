import { describe, expect, it } from 'vitest';
import {
  buildWhatsAppUrl,
  calculateCartTotals,
  escapeHtml,
  filterProducts,
  formatRupiah,
  parseProductsJSON,
  validateProduct,
} from '../src/store.js';

const SAMPLE_PRODUCTS = [
  {
    id: 'kopi-01',
    nama: 'Arabika Ijen Natural 250g',
    kategori: 'Biji Kopi',
    harga: 78000,
    stok: 18,
    deskripsi: 'Aroma beri merah dan karamel.',
    imageUrl: './images/products/arabika-ijen.jpg',
    unggulan: true,
    avg_rating: 4.9,
    seller_whatsapp: '6281234567890',
  },
  {
    id: 'kopi-02',
    nama: 'Cold Brew Black Citrus 250ml',
    kategori: 'Siap Saji',
    harga: 22000,
    stok: 0,
    deskripsi: 'Kopi seduh dingin dengan jeruk.',
    imageUrl: './images/products/cold-brew-citrus.jpg',
    unggulan: false,
    avg_rating: 4.5,
    seller_whatsapp: '6281234567890',
  },
];

describe('formatRupiah & escapeHtml', () => {
  it('memformat harga Rupiah dan melakukan escape XSS', () => {
    expect(formatRupiah(78000)).toBe('Rp 78.000');
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('validateProduct', () => {
  it('memvalidasi produk valid dan menolak harga/stok negatif', () => {
    const validRes = validateProduct({
      nama: 'Arabika Raung 250g',
      kategori: 'Biji Kopi',
      harga: 85000,
      stok: 10,
      imageUrl: './images/products/arabika-raung.jpg',
    });
    expect(validRes.valid).toBe(true);

    const invalidRes = validateProduct({
      nama: 'Produk Rusak',
      kategori: 'Biji Kopi',
      harga: -5000,
      stok: 1.5,
    });
    expect(invalidRes.valid).toBe(false);
  });
});

describe('filterProducts & buildWhatsAppUrl', () => {
  it('memfilter kategori dan menonaktifkan WhatsApp saat stok 0', () => {
    const filtered = filterProducts(SAMPLE_PRODUCTS, { kategori: 'Biji Kopi' });
    expect(filtered).toHaveLength(1);
    expect(buildWhatsAppUrl('6281234567890', SAMPLE_PRODUCTS[0])).toContain('https://wa.me/6281234567890?text=');
    expect(buildWhatsAppUrl('6281234567890', SAMPLE_PRODUCTS[1])).toBeNull();
  });
});

describe('calculateCartTotals & parseProductsJSON', () => {
  it('menghitung total keranjang dengan ongkir dan menolak JSON invalid', () => {
    const totals = calculateCartTotals([{ harga: 78000, quantity: 2 }], 'Kurir Lokal Banyuwangi');
    expect(totals.subtotal).toBe(156000);
    expect(totals.shippingCost).toBe(10000);
    expect(totals.total).toBe(166000);

    expect(parseProductsJSON('{rusak').ok).toBe(false);
  });
});

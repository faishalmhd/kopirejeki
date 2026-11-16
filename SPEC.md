# SPEC.md — Toko Kopi Rejeki (Arsitektur Production Multi-Role v2.0)

## 1. Tujuan & Evolusi Arsitektur
Mengembangkan prototipe katalog statis menjadi aplikasi web e-commerce UMKM **Toko Kopi Rejeki** siap produksi dengan autentikasi berbasis server, database relasional SQLite (dengan skema migrasi PostgreSQL/Supabase), kontrol akses berbasis peran (**RBAC** untuk `admin`, `seller`, dan `pembeli`), keranjang belanja, manajemen pesanan, ulasan pelanggan, serta foto produk beresolusi tinggi.

## 2. Peran Pengguna & Hak Akses (RBAC)
1. **Pembeli (`pembeli`)**:
   - Registrasi & Login akun pelanggan.
   - Menjelajahi katalog, melihat detail produk & ulasan, menambah produk ke keranjang, melakukan checkout pesanan (mengurangi stok secara transaksional), memantau status pesanan, dan mengirim ulasan/rating bintang.
2. **Seller UMKM (`seller`)**:
   - Registrasi & Login akun mitra roastery/toko UMKM.
   - Mengelola produk milik tokonya sendiri (CRUD produk, upload foto kemasan JPG/PNG/WEBP, atur harga/stok/unggulan, Export/Import JSON).
   - Memproses pesanan masuk yang berisi produk tokonya (`Menunggu Konfirmasi` → `Diproses` → `Dikirim` → `Selesai`).
3. **Administrator (`admin`)**:
   - Mengelola seluruh akun pengguna (ubah peran `pembeli` / `seller` / `admin`, aktifkan/nonaktifkan akun).
   - Memoderasi seluruh produk lintas toko dan memantau transaksi global (GMV).

## 3. Data Dummy Bawaan (Password: `Password123!`)
- **Admin**: `admin@kopirejeki.id`
- **Seller 1 (Toko Kopi Rejeki Pusat)**: `seller@kopirejeki.id`
- **Seller 2 (Ijen Highland Roastery)**: `ijenroastery@kopirejeki.id`
- **Pembeli (Budi Santoso)**: `pembeli@kopirejeki.id`

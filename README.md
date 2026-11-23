# Toko Kopi Rejeki

Katalog digital dan dashboard pengelolaan untuk UMKM kopi. Aplikasi berjalan di atas **Express** dengan database **SQLite gratis** memakai modul bawaan Node.js `node:sqlite` (tanpa layanan cloud, tanpa akun, tanpa database eksternal). Seluruh data tersimpan dalam satu file di folder `data/`.

## Fitur

- Katalog publik: pencarian, filter kategori, urutan harga/nama, penanda produk unggulan, dan status stok.
- Tombol **Pesan via WhatsApp** per produk dengan formulir jumlah & catatan; setiap pesanan otomatis tercatat di riwayat.
- Riwayat pesanan WhatsApp di dashboard: filter status (baru/selesai/dibatalkan) dan aksi ubah status.
- **Stok otomatis**: stok produk berkurang saat pesanan ditandai *Selesai*, dan dikembalikan bila pesanan dibatalkan/dibuka lagi.
- **Rekap penjualan** di dashboard: pendapatan pesanan selesai, jumlah pesanan, rata-rata nilai pesanan, pendapatan hari ini/bulan ini, dan produk terlaris.
- Dashboard pengelola (login): tambah, edit, hapus produk, serta pengaturan nama toko, tagline, nomor WhatsApp, alamat, dan jam operasional.
- Import/Export katalog dalam format JSON.
- Autentikasi cookie sesi bertanda tangan HMAC, HttpOnly, SameSite, dan `Secure` saat HTTPS.
- Password admin di-hash dengan bcrypt.
- Keamanan dasar: Helmet + Content Security Policy, rate limit API/login, validasi input, dan proteksi same-origin.
- SPA statis yang dilayani langsung oleh Express (tanpa build step, tanpa CDN wajib).

## Prasyarat

- **Node.js >= 22.5** (modul `node:sqlite` tersedia sejak versi ini).
  - Pada Node 22.5–22.12 modul tersebut memerlukan flag `--experimental-sqlite`. Script `npm start`/`npm run dev` sudah menyertakan flag ini sehingga tetap kompatibel.
  - Disarankan **Node.js 24 LTS atau 26** agar tidak ada peringatan eksperimental.
- npm (sudah termasuk dalam instalasi Node.js).
- Tidak perlu menginstal SQLite atau server database lain.

## Instalasi

```powershell
# di folder proyek
npm install
```

## Konfigurasi (.env)

Salin `.env.example` menjadi `.env`, lalu sesuaikan:

```powershell
Copy-Item .env.example .env
```

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `PORT` | tidak | Port server. Default `3000`. |
| `SESSION_SECRET` | **ya** | String acak minimal 32 karakter untuk menandatangani cookie sesi. |
| `ADMIN_USERNAME` | tidak | Username admin awal. Default `admin`. |
| `ADMIN_PASSWORD` | **ya** | Password admin minimal 8 karakter. Disinkronkan ke database setiap restart. |
| `TRUST_PROXY` | tidak | Set `1` bila berjalan di belakang reverse proxy (Railway/Render/Nginx). |
| `DATA_DIR` | tidak | Lokasi folder database. Default `./data`. |
| `NODE_ENV` | tidak | Set `production` saat deploy (CSP ketat). |
| `COOKIE_SECURE` | tidak | Set `1` untuk memaksa cookie `Secure`. Biasanya sudah otomatis terdeteksi dari HTTPS/`X-Forwarded-Proto`. |

Membuat `SESSION_SECRET` acak:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **Penting:** `.env` berisi rahasia dan **tidak boleh** di-commit. File ini sudah diabaikan oleh `.gitignore`.

## Menjalankan

```powershell
npm start        # jalankan server
npm run dev      # pengembangan, restart otomatis saat file berubah
npm run smoke    # uji asap API end-to-end (memakai database sementara)
```

Buka <http://localhost:3000>.

Saat boot pertama, database dibuat otomatis, 8 produk contoh di-seed, pengaturan default diisi, dan akun admin dibuat dari `.env`.

### Kredensial admin default

Nilai default pada `.env` proyek ini:

- Username: `admin`
- Password: `KopiRejeki2026!`

**WAJIB mengganti password default.** Caranya: ubah `ADMIN_PASSWORD` di `.env` (minimal 8 karakter), lalu **restart server**. Aplikasi menyinkronkan password akun admin dari `.env` setiap kali start. Jika `ADMIN_PASSWORD` dikosongkan dan belum ada akun sama sekali, aplikasi membuat password acak dan menampilkannya sekali di konsol.

## Database & Backup

- Lokasi default: `data/kopi-rejeki.db` (SQLite, mode WAL sehingga muncul juga `kopi-rejeki.db-wal` dan `kopi-rejeki.db-shm`).
- Tabel: `products`, `settings`, `users`, dan `orders` (riwayat pesanan WhatsApp + status). Semua ikut satu file database yang sama.
- Ubah lokasi dengan `DATA_DIR` (contoh di volume persisten).
- Folder `data/` diabaikan git dan tidak boleh di-commit.

**Backup** (hentikan server dulu agar konsisten):

```powershell
Stop-Process -Name node -ErrorAction SilentlyContinue   # atau hentikan proses server Anda
Copy-Item -Recurse data "backup-data-$(Get-Date -Format yyyyMMdd)"
```

**Restore:** hentikan server, ganti folder `data/` dengan hasil backup, lalu start kembali.

## Ringkasan API

| Method | Endpoint | Proteksi | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/health` | publik | Status server & database |
| GET | `/api/products` | publik | Daftar produk |
| GET | `/api/settings` | publik | Pengaturan toko |
| GET | `/api/meta` | publik | Daftar kategori & ikon |
| POST | `/api/orders` | publik | Catat pesanan WhatsApp, mengembalikan `whatsappUrl` |
| POST | `/api/auth/login` | publik | Login, mengeset cookie sesi |
| POST | `/api/auth/logout` | publik | Hapus cookie sesi |
| GET | `/api/auth/me` | publik | Status autentikasi |
| POST | `/api/products` | login | Tambah produk |
| PUT | `/api/products/:id` | login | Ubah produk |
| DELETE | `/api/products/:id` | login | Hapus produk |
| GET | `/api/products/export` | login | Unduh katalog JSON (attachment) |
| POST | `/api/products/import` | login | Ganti katalog dari array JSON |
| GET | `/api/orders` | login | Riwayat pesanan (opsional `?status=baru\|selesai\|dibatalkan`) |
| GET | `/api/orders/summary` | login | Rekap penjualan dari pesanan selesai |
| PATCH | `/api/orders/:id/status` | login | Ubah status; `selesai` memotong stok otomatis |
| PUT | `/api/settings` | login | Simpan pengaturan toko |

Alur pesanan: pelanggan mengisi jumlah, nama (opsional), dan catatan → pesanan tersimpan dengan status `baru` → WhatsApp toko dibuka. Setelah pembayaran/pengiriman dikonfirmasi, pengelola menandai pesanan **Selesai** (stok otomatis berkurang) atau **Batalkan** (stok dikembalikan bila sebelumnya sudah dipotong). Rekap penjualan hanya menghitung pesanan berstatus `selesai`.

Contoh format export/import:

```json
[
  {
    "nama": "Arabika Ijen Natural 250g",
    "kategori": "Biji Kopi",
    "harga": 78000,
    "stok": 18,
    "deskripsi": "Aroma beri merah dan karamel.",
    "imageUrl": "☕",
    "unggulan": true
  }
]
```

Kategori valid: `Biji Kopi`, `Kopi Bubuk`, `Siap Saji`, `Bundling`.

## Struktur Proyek

```
server.js            Express app, routing API, keamanan, static SPA
src/db.js            Koneksi SQLite, skema, seed, produk, pesanan, rekap penjualan
src/auth.js          bcrypt, token sesi HMAC, cookie, middleware
src/validate.js      Validasi produk/pesanan/pengaturan, normalisasi nomor WA
public/index.html    Kerangka SPA
public/styles.css    Gaya tampilan
public/app.js        Logika katalog, login, dashboard
scripts/smoke-test.js Uji asap API end-to-end (database sementara)
data/                Database SQLite (dibuat otomatis, diabaikan git)
.env                 Konfigurasi & rahasia lokal (diabaikan git)
Dockerfile           Image Node 26 untuk deploy container
.dockerignore        Berkas yang tidak disalin ke image
README.md            Dokumentasi ini
```

## Deploy Gratis / Murah

Aplikasi ini cocok untuk Railway, Render, Fly.io, atau VPS kecil. Yang perlu diperhatikan:

1. **Volume persisten** wajib dipasang untuk folder database (`data/`), misalnya mount ke `/app/data`. Tanpa volume, data hilang setiap redeploy.
2. Set environment variable berikut di platform:
   - `SESSION_SECRET` (acak panjang)
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD` (ganti dari default)
   - `NODE_ENV=production`
   - `TRUST_PROXY=1` bila di belakang proxy platform
   - `DATA_DIR=/app/data` bila volume dipasang di lokasi lain
3. Gunakan **HTTPS** (biasanya otomatis di platform). Atribut `Secure` pada cookie sesi aktif otomatis saat request terdeteksi HTTPS (`x-forwarded-proto: https`); set `COOKIE_SECURE=1` bila ingin memaksanya.
4. Jangan mengandalkan filesystem container tanpa volume. Untuk SQLite, hindari banyak replika/instance yang menulis file yang sama.

### Menjalankan dengan Docker

```powershell
docker build -t toko-kopi-rejeki .
docker run -d --name kopi-rejeki `
  -p 3000:3000 `
  -v kopi-data:/app/data `
  -e SESSION_SECRET="ganti-dengan-string-acak-panjang-minimal-32-karakter" `
  -e ADMIN_USERNAME=admin `
  -e ADMIN_PASSWORD="password-kuat-anda" `
  -e NODE_ENV=production `
  toko-kopi-rejeki
```

Buka <http://localhost:3000>. Data tersimpan di volume `kopi-data`.

## Keamanan & Catatan Produksi

- Ganti `ADMIN_PASSWORD` dan `SESSION_SECRET` sebelum dipakai publik.
- Jangan commit `.env`, folder `data/`, atau file backup. `.gitignore` sudah mengabaikan `node_modules/`, `data/`, `.env`, dan `*.log`.
- Lakukan backup database secara berkala (salin folder `data/` saat server berhenti).
- Selalu layani aplikasi melalui HTTPS di produksi.
- Batasi akses dashboard hanya untuk pengelola tepercaya.

## Pemecahan Masalah

- **`EADDRINUSE`**: port sudah dipakai. Hentikan proses lain atau ubah `PORT` di `.env`.
- **`ERR_UNKNOWN_BUILTIN_MODULE` / `node:sqlite` tidak ditemukan**: Node.js terlalu lama. Gunakan Node >= 22.5 (disarankan 24+).
- **Tidak bisa menulis database**: pastikan folder `data/` (atau `DATA_DIR`) dapat ditulis oleh proses Node.
- **Login gagal setelah mengganti `.env`**: restart server agar password dari `ADMIN_PASSWORD` disinkronkan.
- **Cookie tidak tersimpan di produksi**: pastikan HTTPS aktif, `TRUST_PROXY=1` jika di belakang proxy, dan header `x-forwarded-proto: https` diteruskan. Sebagai jalan pintas, set `COOKIE_SECURE=1` setelah HTTPS dipastikan aktif.

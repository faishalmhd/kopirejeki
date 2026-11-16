-- Skema PostgreSQL / Supabase Production untuk Migrasi Skala Besar
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'seller', 'pembeli')),
  shop_name VARCHAR(160) DEFAULT '',
  whatsapp VARCHAR(30) DEFAULT '',
  address TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama VARCHAR(140) NOT NULL,
  kategori VARCHAR(60) NOT NULL,
  harga INTEGER NOT NULL CHECK (harga >= 0),
  stok INTEGER NOT NULL CHECK (stok >= 0),
  deskripsi TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  unggulan BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_name VARCHAR(120) NOT NULL,
  shipping_method VARCHAR(80) NOT NULL,
  shipping_address TEXT NOT NULL,
  notes TEXT DEFAULT '',
  subtotal INTEGER NOT NULL,
  shipping_cost INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  status VARCHAR(40) NOT NULL CHECK (status IN ('Menunggu Konfirmasi', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_name VARCHAR(140) NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_name VARCHAR(120) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

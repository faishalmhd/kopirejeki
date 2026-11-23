'use strict';

const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const HOST = '127.0.0.1';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'SmokeTestPass123!';
const SESSION_SECRET = 'smoke-test-session-secret-minimal-32-karakter-acak';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log('PASS  ' + name);
  } else {
    failed += 1;
    console.error('FAIL  ' + name + (detail ? ' -> ' + detail : ''));
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, child, getLogs) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('Server berhenti saat boot:\n' + getLogs());
    }
    try {
      const response = await fetch(baseUrl + '/api/health');
      if (response.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error('Server tidak siap dalam 20 detik:\n' + getLogs());
}

function cookiesFrom(response) {
  const values = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';')[0]).filter(Boolean);
}

async function run() {
  const port = await getFreePort();
  const baseUrl = 'http://' + HOST + ':' + port;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kopi-smoke-'));

  let output = '';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      SESSION_SECRET,
      ADMIN_USERNAME,
      ADMIN_PASSWORD,
      TRUST_PROXY: '0',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  let cookie = '';

  async function request(pathname, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.origin) headers.Origin = options.origin;

    const response = await fetch(baseUrl + pathname, {
      method: options.method || 'GET',
      headers,
      body,
      redirect: 'manual',
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}
    return { response, status: response.status, text, json, setCookies: cookiesFrom(response) };
  }

  try {
    await waitForServer(baseUrl, child, () => output);

    const health = await request('/api/health');
    check('GET /api/health', health.status === 200 && health.json?.status === 'healthy');

    const products = await request('/api/products');
    check(
      'GET /api/products berisi 8 produk seed',
      products.status === 200 && Array.isArray(products.json?.products) && products.json.products.length === 8,
      'jumlah=' + (products.json?.products?.length ?? 'null')
    );

    const settings = await request('/api/settings');
    check(
      'GET /api/settings mengembalikan pengaturan default',
      settings.status === 200 && settings.json?.settings?.store_name === 'Toko Kopi Rejeki'
    );

    const meta = await request('/api/meta');
    check(
      'GET /api/meta mengembalikan kategori dan emoji',
      meta.status === 200 && meta.json?.categories?.length === 4 && meta.json?.emojis?.length > 0
    );

    const home = await request('/');
    check(
      'GET / menyajikan HTML SPA',
      home.status === 200 &&
        String(home.response.headers.get('content-type')).includes('text/html') &&
        home.text.includes('/app.js')
    );

    const appJs = await request('/app.js');
    check('GET /app.js -> 200', appJs.status === 200 && appJs.text.includes('use strict'));

    const styles = await request('/styles.css');
    check('GET /styles.css -> 200', styles.status === 200 && styles.text.length > 1000);

    const productBody = {
      nama: 'Produk Uji Smoke',
      kategori: 'Biji Kopi',
      harga: 12345,
      stok: 7,
      deskripsi: 'Uji otomatis',
      imageUrl: 'https://example.com/kopi.png',
      unggulan: true,
    };

    for (const [label, method, pathname, body] of [
      ['POST /api/products', 'POST', '/api/products', productBody],
      ['PUT /api/products/:id', 'PUT', '/api/products/kopi-01', productBody],
      ['DELETE /api/products/:id', 'DELETE', '/api/products/kopi-01', undefined],
      ['GET /api/products/export', 'GET', '/api/products/export', undefined],
      [
        'PUT /api/settings',
        'PUT',
        '/api/settings',
        { store_name: 'X', whatsapp_number: '081234567890' },
      ],
      ['POST /api/products/import', 'POST', '/api/products/import', []],
    ]) {
      const result = await request(pathname, { method, body });
      check('Tanpa cookie ' + label + ' -> 401', result.status === 401, 'status=' + result.status);
    }

    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: ADMIN_USERNAME, password: 'password-salah' },
    });
    check('Login salah -> 401', badLogin.status === 401, 'status=' + badLogin.status);

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    });
    const sessionCookie = login.setCookies.find((value) => value.startsWith('kopi_session='));
    cookie = sessionCookie || '';
    check('Login benar -> 200 + cookie sesi', login.status === 200 && Boolean(cookie));

    const me = await request('/api/auth/me', { cookie });
    check(
      'GET /api/auth/me terautentikasi',
      me.status === 200 && me.json?.authenticated === true && me.json?.user?.username === ADMIN_USERNAME
    );

    const created = await request('/api/products', {
      method: 'POST',
      cookie,
      body: { id: 'smoke-1', ...productBody },
    });
    check(
      'Create produk -> 201',
      created.status === 201 && created.json?.product?.id === 'smoke-1',
      'status=' + created.status
    );

    const duplicate = await request('/api/products', {
      method: 'POST',
      cookie,
      body: { id: 'smoke-1', ...productBody },
    });
    check('Create produk ID duplikat -> 409', duplicate.status === 409, 'status=' + duplicate.status);

    const invalid = await request('/api/products', {
      method: 'POST',
      cookie,
      body: { nama: 'Harga Kosong', kategori: 'Biji Kopi', harga: '   ', stok: 1 },
    });
    check('Validasi harga kosong -> 400', invalid.status === 400, 'status=' + invalid.status);

    const invalidImage = await request('/api/products', {
      method: 'POST',
      cookie,
      body: { nama: 'XSS', kategori: 'Biji Kopi', harga: 1000, stok: 1, imageUrl: 'javascript:alert(1)' },
    });
    check('Validasi imageUrl javascript -> 400', invalidImage.status === 400);

    const updated = await request('/api/products/smoke-1', {
      method: 'PUT',
      cookie,
      body: {
        nama: 'Produk Uji Diperbarui',
        kategori: 'Kopi Bubuk',
        harga: 54321,
        stok: 0,
        deskripsi: 'Diperbarui',
        imageUrl: '🧊',
        unggulan: false,
      },
    });
    check(
      'Update produk -> 200',
      updated.status === 200 &&
        updated.json?.product?.nama === 'Produk Uji Diperbarui' &&
        updated.json?.product?.harga === 54321 &&
        updated.json?.product?.unggulan === false
    );

    const missingUpdate = await request('/api/products/tidak-ada', {
      method: 'PUT',
      cookie,
      body: productBody,
    });
    check('Update produk tidak ada -> 404', missingUpdate.status === 404);

    const deleted = await request('/api/products/smoke-1', { method: 'DELETE', cookie });
    check('Delete produk -> 200', deleted.status === 200);

    const deletedAgain = await request('/api/products/smoke-1', { method: 'DELETE', cookie });
    check('Delete produk lagi -> 404', deletedAgain.status === 404);

    const publicOrder = await request('/api/orders', {
      method: 'POST',
      body: {
        product_id: 'kopi-01',
        qty: 2,
        customer_name: 'Pelanggan Uji',
        note: 'Ambil di kedai',
      },
    });
    const orderId = publicOrder.json?.order?.id;
    check(
      'Pesanan publik -> 201, total & WhatsApp URL benar',
      publicOrder.status === 201 &&
        publicOrder.json?.order?.total === 156000 &&
        publicOrder.json?.order?.status === 'baru' &&
        String(publicOrder.json?.whatsappUrl).startsWith('https://wa.me/6281234567890'),
      'status=' + publicOrder.status + ' total=' + (publicOrder.json?.order?.total ?? 'null')
    );

    const overQty = await request('/api/orders', {
      method: 'POST',
      body: { product_id: 'kopi-01', qty: 9999 },
    });
    check('Pesanan melebihi stok -> 409', overQty.status === 409, 'status=' + overQty.status);

    const missingProductOrder = await request('/api/orders', {
      method: 'POST',
      body: { product_id: 'tidak-ada', qty: 1 },
    });
    check(
      'Pesanan produk tidak ada -> 404',
      missingProductOrder.status === 404,
      'status=' + missingProductOrder.status
    );

    const zeroQty = await request('/api/orders', {
      method: 'POST',
      body: { product_id: 'kopi-01', qty: 0 },
    });
    check('Pesanan qty 0 -> 400', zeroQty.status === 400, 'status=' + zeroQty.status);

    const ordersNoAuth = await request('/api/orders');
    check('Tanpa cookie GET /api/orders -> 401', ordersNoAuth.status === 401);

    const summaryNoAuth = await request('/api/orders/summary');
    check('Tanpa cookie GET /api/orders/summary -> 401', summaryNoAuth.status === 401);

    const ordersAuthed = await request('/api/orders', { cookie });
    const foundOrder = (ordersAuthed.json?.orders || []).find((item) => item.id === orderId);
    check(
      'GET /api/orders berisi pesanan baru',
      ordersAuthed.status === 200 && foundOrder?.status === 'baru'
    );

    const stockOf = async (id) => {
      const list = await request('/api/products');
      return (list.json?.products || []).find((item) => item.id === id)?.stok;
    };

    const completedOrder = await request('/api/orders/' + orderId + '/status', {
      method: 'PATCH',
      cookie,
      body: { status: 'selesai' },
    });
    const stockAfterComplete = await stockOf('kopi-01');
    check(
      'Selesaikan pesanan memotong stok otomatis (18 -> 16)',
      completedOrder.status === 200 &&
        completedOrder.json?.order?.status === 'selesai' &&
        stockAfterComplete === 16,
      'status=' + completedOrder.status + ' stok=' + stockAfterComplete
    );

    const summaryAfterComplete = await request('/api/orders/summary', { cookie });
    check(
      'Rekap penjualan menghitung pendapatan pesanan selesai',
      summaryAfterComplete.status === 200 &&
        summaryAfterComplete.json?.summary?.revenue === 156000 &&
        summaryAfterComplete.json?.summary?.completedOrders === 1 &&
        summaryAfterComplete.json?.summary?.itemsSold === 2,
      'revenue=' + (summaryAfterComplete.json?.summary?.revenue ?? 'null')
    );

    const completedAgain = await request('/api/orders/' + orderId + '/status', {
      method: 'PATCH',
      cookie,
      body: { status: 'selesai' },
    });
    const stockAfterCompleteAgain = await stockOf('kopi-01');
    check(
      'Selesaikan ulang idempoten (stok tetap 16)',
      completedAgain.status === 200 && stockAfterCompleteAgain === 16,
      'stok=' + stockAfterCompleteAgain
    );

    const cancelledOrder = await request('/api/orders/' + orderId + '/status', {
      method: 'PATCH',
      cookie,
      body: { status: 'dibatalkan' },
    });
    const stockAfterCancel = await stockOf('kopi-01');
    check(
      'Batalkan pesanan selesai mengembalikan stok (16 -> 18)',
      cancelledOrder.status === 200 &&
        cancelledOrder.json?.order?.status === 'dibatalkan' &&
        stockAfterCancel === 18,
      'status=' + cancelledOrder.status + ' stok=' + stockAfterCancel
    );

    const invalidStatusChange = await request('/api/orders/' + orderId + '/status', {
      method: 'PATCH',
      cookie,
      body: { status: 'status-ngawur' },
    });
    check(
      'Ubah status tidak valid -> 400',
      invalidStatusChange.status === 400,
      'status=' + invalidStatusChange.status
    );

    const crossSiteOrder = await request('/api/orders', {
      method: 'POST',
      origin: 'http://evil.example',
      body: { product_id: 'kopi-01', qty: 1 },
    });
    check(
      'Pesanan lintas situs -> 403',
      crossSiteOrder.status === 403,
      'status=' + crossSiteOrder.status
    );

    const importPayload = [
      {
        id: 'imp-1',
        nama: 'Import A',
        kategori: 'Siap Saji',
        harga: 1000,
        stok: 2,
        deskripsi: 'A',
        imageUrl: '☕',
        unggulan: false,
      },
      {
        id: 'imp-1',
        nama: 'Import B',
        kategori: 'Bundling',
        harga: 2000,
        stok: 3,
        deskripsi: 'B',
        imageUrl: 'https://example.com/b.png',
        unggulan: 'false',
      },
    ];
    const imported = await request('/api/products/import', {
      method: 'POST',
      cookie,
      body: importPayload,
    });
    const importedIds = (imported.json?.products || []).map((item) => item.id);
    check(
      'Import mengganti seluruh produk dengan ID unik',
      imported.status === 200 &&
        imported.json?.products?.length === 2 &&
        new Set(importedIds).size === 2
    );
    check(
      'Import menormalkan flag unggulan "false"',
      (imported.json?.products || []).every((item) => item.unggulan === false)
    );

    const exported = await request('/api/products/export', { cookie });
    let exportedList = null;
    try {
      exportedList = JSON.parse(exported.text);
    } catch {}
    check(
      'Export JSON -> 200 + array produk',
      exported.status === 200 &&
        String(exported.response.headers.get('content-type')).includes('application/json') &&
        String(exported.response.headers.get('content-disposition')).includes('attachment') &&
        Array.isArray(exportedList) &&
        exportedList.length === 2
    );

    const normalized = await request('/api/settings', {
      method: 'PUT',
      cookie,
      body: {
        store_name: 'Toko Uji',
        store_tagline: 'Tagline Uji',
        whatsapp_number: '081234567890',
        store_address: 'Alamat Uji',
        store_hours: '08.00-21.00',
      },
    });
    check(
      'PUT /api/settings menormalkan 081234567890 -> 6281234567890',
      normalized.status === 200 && normalized.json?.settings?.whatsapp_number === '6281234567890',
      'wa=' + (normalized.json?.settings?.whatsapp_number ?? 'null')
    );

    const normalizedPlus = await request('/api/settings', {
      method: 'PUT',
      cookie,
      body: {
        store_name: 'Toko Uji',
        store_tagline: 'Tagline Uji',
        whatsapp_number: '+62 812-3456-7890',
        store_address: 'Alamat Uji',
        store_hours: '08.00-21.00',
      },
    });
    check(
      'PUT /api/settings menormalkan format +62',
      normalizedPlus.status === 200 && normalizedPlus.json?.settings?.whatsapp_number === '6281234567890'
    );

    const invalidSettings = await request('/api/settings', {
      method: 'PUT',
      cookie,
      body: {
        store_name: 'Toko Uji',
        store_tagline: 'Tagline Uji',
        whatsapp_number: 'bukan-nomor',
        store_address: 'Alamat Uji',
        store_hours: '08.00-21.00',
      },
    });
    check('PUT /api/settings nomor invalid -> 400', invalidSettings.status === 400);

    const crossOrigin = await request('/api/products', {
      method: 'POST',
      cookie,
      origin: 'http://evil.example',
      body: { nama: 'Lintas Situs', kategori: 'Biji Kopi', harga: 1000, stok: 1 },
    });
    check('Permintaan lintas situs -> 403', crossOrigin.status === 403, 'status=' + crossOrigin.status);

    const sameOrigin = await request('/api/products', {
      method: 'POST',
      cookie,
      origin: baseUrl,
      body: { id: 'smoke-origin', ...productBody },
    });
    check('Permintaan same-origin -> 201', sameOrigin.status === 201, 'status=' + sameOrigin.status);
    await request('/api/products/smoke-origin', { method: 'DELETE', cookie });

    const badJson = await request('/api/products', {
      method: 'POST',
      cookie,
      body: '{bukan json',
    });
    check('JSON rusak -> 400', badJson.status === 400);

    const unknownApi = await request('/api/tidak-ada');
    check('Endpoint API tidak dikenal -> 404 JSON', unknownApi.status === 404 && unknownApi.json?.ok === false);

    const logout = await request('/api/auth/logout', { method: 'POST', cookie });
    check('Logout -> 200', logout.status === 200 && logout.json?.ok === true);

    const afterLogout = await request('/api/products/export');
    check('Setelah logout tanpa cookie export -> 401', afterLogout.status === 401);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      const exited = await Promise.race([
        new Promise((resolve) => child.once('exit', () => resolve(true))),
        wait(3000).then(() => false),
      ]);
      if (!exited && child.exitCode === null) child.kill('SIGKILL');
    }
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  console.log('\nHasil: ' + passed + ' lulus, ' + failed + ' gagal.');
  if (failed > 0) {
    console.error('\nLog server:\n' + output);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

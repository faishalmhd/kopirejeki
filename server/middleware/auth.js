import jwt from 'jsonwebtoken';
import { queryOne } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'toko-kopi-rejeki-dev-secret-change-in-prod-2026';
export const COOKIE_NAME = 'kopirejeki_session';

export function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function attachOptionalUser(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = queryOne(
      'SELECT id, name, email, role, shop_name, whatsapp, address, is_active, created_at FROM users WHERE id = ?',
      [payload.sub]
    );
    if (user && user.is_active) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  return next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu untuk mengakses fitur ini.' });
  }
  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Akses ditolak. Fitur ini khusus untuk peran: ${roles.join(', ')}.`,
      });
    }
    return next();
  };
}

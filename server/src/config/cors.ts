import type { CorsOptions } from 'cors';
import { env } from './env';
import { buildAllowedOrigins } from './network';

// Build the origin list once at startup. It reflects every IPv4 LAN address
// the host machine has at the moment the server starts.
// If the machine's IP changes (DHCP renewal) simply restart the server.
const ALLOWED_ORIGINS = buildAllowedOrigins([env.CLIENT_ORIGIN]);

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // No Origin header → curl / Postman / same-origin server call → allow
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Fallback for dev: accept any origin whose hostname is a detected LAN IP
    // (handles dynamic or unexpected ports)
    if (env.NODE_ENV === 'development') {
      try {
        const { hostname } = new URL(origin);
        const detected = ALLOWED_ORIGINS.some((o) => {
          try { return new URL(o).hostname === hostname; } catch { return false; }
        });
        if (detected) return callback(null, true);
      } catch { /* invalid URL — fall through */ }
    }

    callback(new Error(`CORS: origin "${origin}" is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

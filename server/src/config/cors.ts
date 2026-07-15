import type { CorsOptions } from 'cors';
import { env } from './env';

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // In development, allow any localhost origin or the specific CLIENT_ORIGIN
    if (!origin || (env.NODE_ENV === 'development' && origin.startsWith('http://localhost:'))) {
      callback(null, true);
    } else {
      // Validate against the exact string in production or when not localhost
      if (origin === env.CLIENT_ORIGIN) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { verifyAccessToken } from '../../config/jwt';
import { buildAllowedOrigins } from '../../config/network';
import { logger } from '../../shared/logger';

let ioInstance: Server | null = null;

export async function bootstrapSocket(httpServer: HttpServer) {
  // Auto-detect LAN IPv4 addresses and include CLIENT_ORIGIN
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:7333';
  const allowedOrigins = buildAllowedOrigins([clientOrigin]);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        // In production, allow configured CLIENT_ORIGIN
        if (clientOrigin && origin === clientOrigin) return callback(null, true);
        // Fallback for dev: allow any origin whose hostname is in the detected list
        if (process.env.NODE_ENV === 'development') {
          try {
            const { hostname } = new URL(origin);
            const detected = allowedOrigins.some((o) => {
              try { return new URL(o).hostname === hostname; } catch { return false; }
            });
            if (detected) return callback(null, true);
          } catch { /* invalid URL */ }
        }
        callback(new Error(`Socket CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    },
  });

  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter connected and enabled.');
    } catch (err) {
      logger.error('Failed to connect Socket.IO Redis adapter:', err);
    }
  } else {
    logger.info('REDIS_URL not set — Socket.IO running with default in-memory adapter.');
  }

  ioInstance = io;

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = verifyAccessToken(token);
      (socket as any).userId = decoded.sub;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;

    if (userId) {
      // Join a room for the user to make broadcasting easy across all replicas
      socket.join(`user:${userId}`);
    }
  });

  return io;
}

export function getIoInstance() {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized.');
  }
  return ioInstance;
}

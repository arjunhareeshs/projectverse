import type { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../config/jwt';
import { buildAllowedOrigins } from '../../config/network';

// Map of userId to an array of socketIds to handle multiple connections per user
const userSockets: Map<string, Set<string>> = new Map();
let ioInstance: Server | null = null;

export function bootstrapSocket(httpServer: HttpServer) {
  // Auto-detect every LAN IPv4 address on this machine and build the same
  // allowed-origins list used by the HTTP CORS middleware.
  const allowedOrigins = buildAllowedOrigins([process.env.CLIENT_ORIGIN || 'http://localhost:7333']);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
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
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);

      // Join a room for the user to make broadcasting easy
      socket.join(`user:${userId}`);
    }

    socket.on('disconnect', () => {
      if (userId && userSockets.has(userId)) {
        userSockets.get(userId)!.delete(socket.id);
        if (userSockets.get(userId)!.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });

  return io;
}

export function getIoInstance() {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized.');
  }
  return ioInstance;
}

export function getSocketsForUser(userId: string): string[] {
  return Array.from(userSockets.get(userId) || []);
}

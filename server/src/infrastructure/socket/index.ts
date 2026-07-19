import type { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../config/jwt';

// Map of userId to an array of socketIds to handle multiple connections per user
const userSockets: Map<string, Set<string>> = new Map();
let ioInstance: Server | null = null;

export function bootstrapSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
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

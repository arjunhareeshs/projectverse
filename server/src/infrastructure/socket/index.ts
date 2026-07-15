import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';

export function bootstrapSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN,
      credentials: true,
    },
  });

  io.of('/notifications').on('connection', (socket) => {
    socket.emit('connected', { namespace: 'notifications' });
  });

  return io;
}

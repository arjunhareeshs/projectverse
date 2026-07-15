import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { bootstrapSocket } from './infrastructure/socket';
import { logger } from './shared/logger';

const app = createApp();
const httpServer = createServer(app);

bootstrapSocket(httpServer);

httpServer.listen(env.SERVER_PORT, () => {
  logger.info(`Server running on port ${env.SERVER_PORT}`);
});

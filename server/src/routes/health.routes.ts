import { Router } from 'express';
import { prisma } from '../shared/database';

export const healthRoutes = Router();

// Cheap liveness probe: returns 200 if Express is answering requests
healthRoutes.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'projectverse-server' });
});

// Readiness probe: verifies database connectivity before traffic is routed
healthRoutes.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'connected', service: 'projectverse-server' });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
});

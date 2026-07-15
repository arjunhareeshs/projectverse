import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { corsOptions } from './config/cors';
import { authRoutes } from './modules/auth/auth.routes';
import { projectRoutes } from './modules/projects/project.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { teamRoutes } from './modules/teams/team.routes';
import { taskRoutes } from './modules/tasks/task.routes';
import { documentRoutes } from './modules/documents/document.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { scheduleRoutes } from './modules/schedule/schedule.routes';
import { healthRoutes } from './routes/health.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { aiRoutes } from './modules/ai/ai.routes';
import { internalRoutes } from './modules/internal/internal.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: false, // Allow loading files in frontend via static server
  }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 500,
    }),
  );
  app.use(cors(corsOptions));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // Serve uploaded files statically
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/internal', internalRoutes);

  app.use(errorHandler);

  return app;
}

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
import { publicOpportunitiesRoutes } from './modules/dashboard/public.routes';
import { teamRoutes } from './modules/teams/team.routes';
import { taskRoutes } from './modules/tasks/task.routes';
import { documentRoutes } from './modules/documents/document.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { healthRoutes } from './routes/health.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { internalRoutes } from './modules/internal/internal.routes';
import { githubRoutes } from './modules/github/github.routes';
import { lifecycleRoutes } from './modules/lifecycle/lifecycle.routes';
import { proposalRoutes } from './modules/projects/proposals.routes';
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
  // express.json() skips parsing (leaves req.body undefined) when a request has no
  // Content-Type: application/json body — e.g. axios.post(url) with no second arg.
  // Routes that do `const { x } = req.body` or `schema.safeParse(req.body)` then throw/400
  // on a perfectly valid "no options" call. Default it to {} so those routes see an empty object.
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });

  // Serve uploaded files statically
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicOpportunitiesRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/proposals', proposalRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/internal', internalRoutes);
  app.use('/api/github', githubRoutes);
  app.use('/api/lifecycle', lifecycleRoutes);

  // This is a JSON API with no root page of its own — the actual app lives
  // on the frontend dev server (http://localhost:7333). Anyone landing here
  // directly (typo, stale bookmark, address-bar autocomplete) gets a clear
  // JSON message instead of Express's default HTML 404 page.
  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found. This is the API server — the app is at http://localhost:7333' });
  });

  app.use(errorHandler);

  return app;
}

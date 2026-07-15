import { Router } from 'express';
import { internalAuth } from '../../middleware/internalAuth';
import { internalController } from './internal.controller';

const router = Router();

// All internal routes require HMAC signature from the AI service
router.use(internalAuth);

// Team members
router.get('/teams/:id/members', internalController.getTeamMembers as any);

// Team messages
router.post('/teams/:id/messages', internalController.postTeamMessage as any);

// Notifications
router.post('/notifications/broadcast', internalController.broadcastNotification as any);
router.post('/notifications', internalController.createNotification as any);

// Tasks
router.get('/tasks', internalController.getTasks as any);
router.post('/tasks', internalController.createTask as any);
router.patch('/tasks/:id', internalController.updateTask as any);

// Projects
router.get('/projects', internalController.getProjects as any);

// Teams
router.get('/teams', internalController.getTeams as any);

// Browser automation: short-lived JWT for the headed Playwright session
router.get('/browser-token', internalController.getBrowserToken as any);

export const internalRoutes = router;

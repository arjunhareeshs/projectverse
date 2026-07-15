import { Router } from 'express';
import { aiController } from './ai.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

router.use(authGuard);

// Simple non-streaming query (used by Project Designer, AllProjects, etc.)
router.post('/query', aiController.handleQuery);

// Real streaming agent chat with full tool support
router.post('/chat', aiController.handleChat);

export { router as aiRoutes };


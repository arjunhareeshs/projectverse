import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Protected routes
router.get('/me', authGuard, AuthController.me as any);
router.get('/users', authGuard, AuthController.getUsers as any);

export { router as authRoutes };

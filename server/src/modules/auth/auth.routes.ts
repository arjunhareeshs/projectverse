import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes with brute-force protection
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/google', authLimiter, AuthController.googleLogin);



// Protected routes
router.get('/me', authGuard, AuthController.me as any);
router.patch('/github-username', authGuard, AuthController.updateGithubUsername as any);
router.get('/users', authGuard, AuthController.getUsers as any);

export { router as authRoutes };

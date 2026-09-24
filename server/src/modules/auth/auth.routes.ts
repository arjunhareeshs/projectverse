import { Router } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { createRateLimiter } from '../../shared/rateLimit';
import { AuthController } from './auth.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

// Keyed by IP + account, so a whole campus behind one NAT IP can still log in
// while brute force against a single account stays capped.
const authLimiter = createRateLimiter('auth', {
  windowMs: 15 * 60 * 1000,
  limit: 25,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  keyGenerator: (req) => {
    const id = String(req.body?.identifier || req.body?.email || '').trim().toLowerCase();
    return `ip:${ipKeyGenerator(req.ip || '')}:${id}`;
  },
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

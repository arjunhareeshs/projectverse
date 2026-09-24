import { Router } from 'express';
import { createRateLimiter } from '../../shared/rateLimit';
import { prisma } from '../../shared/database';

const router = Router();

// No authGuard — a crash can happen before login or while the session is broken,
// and that is exactly when we most need to hear about it. Rate-limited instead
// of role-gated to prevent abuse as an open write endpoint.
router.use(createRateLimiter('client-errors', { windowMs: 60_000, limit: 30 }));

router.post('/', async (req, res) => {
  const { message, stack, url, userId } = req.body || {};
  if (!message || typeof message !== 'string') {
    res.status(400).json({ message: 'message is required' });
    return;
  }

  try {
    await prisma.clientErrorLog.create({
      data: {
        message: String(message).slice(0, 2000),
        stack: typeof stack === 'string' ? stack.slice(0, 8000) : undefined,
        url: typeof url === 'string' ? url.slice(0, 500) : undefined,
        userAgent: req.headers['user-agent']?.slice(0, 300),
        userId: typeof userId === 'string' ? userId : undefined,
      },
    });
  } catch {
    // Never fail the client over a logging error
  }

  res.status(204).end();
});

export const clientErrorRoutes = router;

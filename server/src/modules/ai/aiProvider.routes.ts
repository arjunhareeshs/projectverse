import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authGuard } from '../../middleware/authGuard';
import { aiProviderController } from './aiProvider.controller';

const router = Router();

// Dedicated rate limiter for key management & validation requests
// 30 requests per 15 minutes to allow comfortable configuration while stopping brute force / spam
const keyManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { message: 'Too many API key operations. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authGuard);
router.use(keyManagementLimiter);

router.get('/', (req, res) => aiProviderController.getProviders(req as any, res));
router.put('/:provider', (req, res) => aiProviderController.saveProvider(req as any, res));
router.delete('/:provider', (req, res) => aiProviderController.deleteProvider(req as any, res));
router.post('/:provider/validate', (req, res) => aiProviderController.validateProvider(req as any, res));

export const aiProviderRoutes = router;

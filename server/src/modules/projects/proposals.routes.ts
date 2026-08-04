import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { catalogController } from './project.catalog.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

router.use(authGuard);

const proposalEvaluateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30, // 30 evaluations per 15 minutes per user
  message: { message: 'Too many proposal evaluation requests. Please wait a few minutes before trying again.' },
});

router.post('/evaluate', proposalEvaluateLimiter, catalogController.validateProposal);
router.post('/', catalogController.proposeProblemStatement);

export const proposalRoutes = router;

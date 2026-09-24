import { Router } from 'express';
import { createRateLimiter } from '../../shared/rateLimit';
import { catalogController } from './project.catalog.controller';
import { proposalReadController } from './proposal.read.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

router.use(authGuard);

const proposalEvaluateLimiter = createRateLimiter('proposal-evaluate', {
  windowMs: 15 * 60 * 1000,
  limit: 30, // per user
  message: 'Too many proposal evaluation requests. Please wait a few minutes before trying again.',
});

router.post('/evaluate', proposalEvaluateLimiter, catalogController.validateProposal);
router.post('/', catalogController.proposeProblemStatement);
router.get('/mine', proposalReadController.getMyProposals);
router.get('/:id', proposalReadController.getProposalById);
router.post('/:id/claim', proposalReadController.claimSelfProposal);

export const proposalRoutes = router;

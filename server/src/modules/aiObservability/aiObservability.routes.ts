import { Router } from 'express';
import { authGuard, requireRole } from '../../middleware/authGuard';
import { aiObservabilityController } from './aiObservability.controller';

const router = Router();

// Restricted to the DEVELOPER role only — not even ADMIN can see this.
router.use(authGuard);
router.use(requireRole('DEVELOPER'));

router.get('/overview', aiObservabilityController.getOverview);
router.get('/timeseries', aiObservabilityController.getTimeseries);
router.get('/users', aiObservabilityController.getUsersByUsage);
router.get('/logs', aiObservabilityController.getRecentLogs);
router.get('/system-logs', aiObservabilityController.getSystemLogs);
router.get('/provider-health', aiObservabilityController.getProviderHealth);

export const aiObservabilityRoutes = router;

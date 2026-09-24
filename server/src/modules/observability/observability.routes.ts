import { Router } from 'express';
import { authGuard, requireRole } from '../../middleware/authGuard';
import { observabilityController } from './observability.controller';

const router = Router();

// DEVELOPER-only, same as the AI usage dashboard.
router.use(authGuard);
router.use(requireRole('DEVELOPER'));

router.get('/requests/overview', observabilityController.getRequestOverview);
router.get('/requests/by-route', observabilityController.getRequestsByRoute);
router.get('/requests/recent', observabilityController.getRecentRequests);
router.get('/requests/timeseries', observabilityController.getRequestTimeseries);
router.get('/requests/status-distribution', observabilityController.getStatusDistribution);
router.get('/errors/timeseries', observabilityController.getErrorTimeseries);
router.get('/metrics', observabilityController.getMetrics);
router.get('/errors/backend', observabilityController.getBackendErrors);
router.get('/errors/client', observabilityController.getClientErrors);

export const observabilityRoutes = router;

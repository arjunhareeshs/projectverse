import { Router } from 'express';
import { recommendationController } from './recommendation.controller';

const router = Router();

// ── Status & Recompute ────────────────────────────────────────────────────────
// Important: /recompute and /status must be registered BEFORE /:id so Express
// does not mistake them for an ID segment.
router.get('/recommendations/status', recommendationController.getRecommendationsStatus);
router.post('/recommendations/recompute', recommendationController.recomputeRecommendations);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/recommendations', recommendationController.getRecommendations);
router.get('/recommendations/:id', recommendationController.getRecommendationById);
router.patch('/recommendations/:id', recommendationController.updateRecommendationStatus);

export const recommendationRoutes = router;

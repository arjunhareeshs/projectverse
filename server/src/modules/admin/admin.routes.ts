import { Router } from 'express';
import multer from 'multer';
import { adminController } from './admin.controller';
import { authGuard, requireRole } from '../../middleware/authGuard';
import { insightsRoutes } from '../insights/insights.routes';
import { recommendationRoutes } from '../recommendation/recommendation.routes';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// All admin routes require authentication and ADMIN role
router.use(authGuard);
router.use(requireRole('ADMIN'));

// Stats
router.get('/stats', adminController.getStats);

// Students Data Management & Ingest
router.get('/students', adminController.getStudents);
router.post('/students', adminController.createStudent);
router.post('/students/bulk', upload.single('file'), adminController.bulkUploadStudents);

// Teams Data Management & Ingest
router.get('/teams', adminController.getTeams);
router.post('/teams', adminController.createTeam);
router.post('/teams/bulk', upload.single('file'), adminController.bulkUploadTeams);

// Achievements Ingest
router.get('/achievements', adminController.getAchievements);
router.post('/achievements', adminController.createAchievement);
router.post('/achievements/bulk', upload.single('file'), adminController.bulkUploadAchievements);

// Insights Portal Routes (Top Teams, Top Students, Overlaps, Standouts, Recompute)
router.use('/', insightsRoutes);

// Recommendation Engine Routes (Opportunity Matching)
router.use('/', recommendationRoutes);

export const adminRoutes = router;

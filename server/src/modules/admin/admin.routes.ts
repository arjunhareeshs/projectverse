import { Router } from 'express';
import multer from 'multer';
import { adminController } from './admin.controller';
import { authGuard } from '../../middleware/authGuard';
import { requireRole } from '../../middleware/requireRole';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// All admin routes require authentication and ADMIN role
router.use(authGuard);
router.use(requireRole('ADMIN'));

// Stats
router.get('/stats', adminController.getStats);

// Students
router.get('/students', adminController.getStudents);
router.post('/students', adminController.createStudent);
router.post('/students/bulk', upload.single('file'), adminController.bulkUploadStudents);

// Teams
router.get('/teams', adminController.getTeams);
router.post('/teams', adminController.createTeam);
router.post('/teams/bulk', upload.single('file'), adminController.bulkUploadTeams);

// Achievements
router.get('/achievements', adminController.getAchievements);
router.post('/achievements', adminController.createAchievement);
router.post('/achievements/bulk', upload.single('file'), adminController.bulkUploadAchievements);

// Trends
router.get('/trends/teams', adminController.getTeamTrends);
router.get('/trends/students', adminController.getStudentTrends);

// Chat
router.get('/chat/sessions', adminController.getChatSessions);
router.get('/chat/history', adminController.getChatHistory);
router.post('/chat', adminController.saveChat);
router.post('/chat/generate', adminController.generateChat);
router.get('/chat/search', adminController.searchContext);
router.get('/chat/teams/:id', adminController.getTeamDetail);
router.get('/chat/students/:id', adminController.getStudentDetail);

export const adminRoutes = router;

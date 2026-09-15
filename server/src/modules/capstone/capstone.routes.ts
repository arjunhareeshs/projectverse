import { Router } from 'express';
import { capstoneController } from './capstone.controller';
import { authGuard, requireRole } from '../../middleware/authGuard';

const router = Router();

// All capstone routes require authentication
router.use(authGuard);

// ─── Problem Statements (Admin & Student) ────────────────────────────────────
router.get('/problems', capstoneController.getProblems);
router.post('/problems', requireRole('ADMIN'), capstoneController.createProblem);
router.patch('/problems/:id', requireRole('ADMIN'), capstoneController.updateProblem);
router.delete('/problems/:id', requireRole('ADMIN'), capstoneController.deleteProblem);

// ─── Admin Analytics ─────────────────────────────────────────────────────────
router.get('/admin/stats', requireRole('ADMIN'), capstoneController.getAdminStats);

// ─── Student Selections & Submissions ────────────────────────────────────────
router.get('/my', capstoneController.getMySelections);
router.post('/:problemId/claim', capstoneController.claimProblem);
router.post('/:selectionId/submit-github', capstoneController.submitGithub);
router.get('/:selectionId/mcq', capstoneController.getMcqQuestions);
router.post('/:selectionId/mcq/submit', capstoneController.submitMcqAnswers);

export { router as capstoneRoutes };

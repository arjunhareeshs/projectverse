import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { requireRole } from '../../middleware/requireRole';
import { upload } from '../../infrastructure/storage/multer';
import { validateBody, requireProjectAccess } from './lifecycle.middleware';
import {
  intakeSchema,
  durationCheckSchema,
  suggestMembersSchema,
  dailyLogSchema,
  mentorAskSchema,
  workPackageStatusSchema,
  workPackageAssignSchema,
  milestoneStatusSchema,
  deadlineChangeSchema,
  flagResolveSchema,
  manualNoteSchema,
  memberAddSchema,
  featureCreateSchema,
  featureUpdateSchema,
  phaseSubmitSchema,
  phaseReviewSchema,
} from './lifecycle.schemas';
import { lifecycleController } from './lifecycle.controller';

const router = Router();

router.use(authGuard);

// Asset upload endpoint for daily log screenshots and evidence
router.post('/upload-asset', upload.single('image'), lifecycleController.uploadAsset as any);

// Intake endpoints
router.post('/:projectId/intake', requireProjectAccess, validateBody(intakeSchema), lifecycleController.handleIntake as any);
router.post('/:projectId/intake/duration-check', validateBody(durationCheckSchema), lifecycleController.checkDuration as any);
router.post('/:projectId/intake/suggest-members', validateBody(suggestMembersSchema), lifecycleController.suggestMembers as any);

// State & event endpoints
router.get('/:projectId/log-state', requireProjectAccess, lifecycleController.getLogState as any);
router.get('/:projectId/events', requireProjectAccess, lifecycleController.getEvents as any);

// Operational state endpoints
router.patch('/:projectId/work-packages/:wpId/status', requireProjectAccess, validateBody(workPackageStatusSchema), lifecycleController.updateWorkPackageStatus as any);
router.patch('/:projectId/work-packages/:wpId/assign', requireProjectAccess, validateBody(workPackageAssignSchema), lifecycleController.assignWorkPackage as any);
router.patch('/:projectId/milestones/:msId/status', requireProjectAccess, validateBody(milestoneStatusSchema), lifecycleController.updateMilestoneStatus as any);
router.patch('/:projectId/milestones/:msId/deadline', requireProjectAccess, validateBody(deadlineChangeSchema), lifecycleController.changeDeadline as any);
router.patch('/:projectId/flags/:flagId/resolve', requireProjectAccess, validateBody(flagResolveSchema), lifecycleController.resolveFlag as any);
router.post('/:projectId/notes', requireProjectAccess, validateBody(manualNoteSchema), lifecycleController.addManualNote as any);
router.post('/:projectId/members/add', requireProjectAccess, validateBody(memberAddSchema), lifecycleController.addMember as any);
router.delete('/:projectId/members/:userId', requireProjectAccess, lifecycleController.removeMember as any);

// Execution Document & Phase Reward endpoints
router.post('/:projectId/document/generate', requireProjectAccess, lifecycleController.generateDocument as any);
router.get('/:projectId/document', requireProjectAccess, lifecycleController.getDocument as any);
router.put('/:projectId/document', requireProjectAccess, lifecycleController.saveDocument as any);
router.get('/:projectId/document/download', requireProjectAccess, lifecycleController.downloadDocument as any);

// Feature extraction & reward-point endpoints
router.get('/:projectId/features', requireProjectAccess, lifecycleController.getFeatures as any);
router.post('/:projectId/features', requireProjectAccess, validateBody(featureCreateSchema), lifecycleController.addFeature as any);
router.patch('/:projectId/features/:featureId', requireProjectAccess, validateBody(featureUpdateSchema), lifecycleController.updateFeature as any);
router.delete('/:projectId/features/:featureId', requireProjectAccess, lifecycleController.removeFeature as any);

// Phase execution & faculty/admin review endpoints
router.get('/:projectId/phases', requireProjectAccess, lifecycleController.getPhases as any);
router.post('/:projectId/phases/:phaseId/submit', requireProjectAccess, validateBody(phaseSubmitSchema), lifecycleController.submitPhase as any);
router.post('/:projectId/phases/:phaseId/review', requireRole(['ADMIN', 'FACULTY']) as any, validateBody(phaseReviewSchema), lifecycleController.reviewPhase as any);

// Daily work log endpoints
router.get('/:projectId/daily-log/draft', requireProjectAccess, lifecycleController.getDailyLogDraft as any);
router.post('/:projectId/daily-log', requireProjectAccess, validateBody(dailyLogSchema), lifecycleController.upsertDailyLog as any);
router.get('/:projectId/daily-logs', requireProjectAccess, lifecycleController.getDailyLogs as any);
router.get('/:projectId/workload', requireProjectAccess, lifecycleController.getWorkload as any);

// 15-day evaluation endpoints
router.post('/:projectId/evaluation/run', requireRole('ADMIN') as any, lifecycleController.runEvaluation as any);
router.get('/:projectId/evaluations', requireProjectAccess, lifecycleController.getEvaluations as any);
router.get('/:projectId/evaluations/:reportId', requireProjectAccess, lifecycleController.getEvaluationById as any);

// AI Mentor endpoints
router.get('/:projectId/mentor/status', requireProjectAccess, lifecycleController.getMentorStatus as any);
router.post('/:projectId/mentor/ask', requireProjectAccess, validateBody(mentorAskSchema), lifecycleController.askMentor as any);

export const lifecycleRoutes = router;

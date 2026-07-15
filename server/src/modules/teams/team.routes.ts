import { Router } from 'express';
import { teamController } from './team.controller';
import { authGuard } from '../../middleware/authGuard';
import { requireRole } from '../../middleware/requireRole';

const router = Router();

router.use(authGuard);

router.get('/', teamController.getTeams);
router.post('/', teamController.createTeam);
router.get('/candidates', teamController.searchCandidates);

router.post('/collaborations/:collabId/accept', teamController.acceptCollaboration);
router.post('/collaborations/:collabId/decline', teamController.declineCollaboration);

router.get('/:id', teamController.getTeamById);
router.patch('/:id', teamController.updateTeam);

router.post('/:id/members', requireRole('ADMIN'), teamController.addMember);
router.delete('/:id/members/:userId', teamController.removeMember);

router.get('/:id/stats', teamController.getTeamStats);
router.get('/:id/coordination', teamController.getCoordinationMetrics);
router.post('/:id/insights', teamController.getAIInsights);

router.get('/:id/invites', teamController.getInvites);
router.post('/:id/invites', teamController.inviteMember);
router.post('/:id/join', teamController.requestToJoin);
router.post('/:id/invites/:inviteId/accept', teamController.acceptInvite);
router.post('/:id/invites/:inviteId/decline', teamController.declineInvite);

router.get('/:id/messages', teamController.getMessages);
router.post('/:id/messages', teamController.sendMessage);

router.get('/:id/tasks', teamController.getTeamTasks);
router.post('/:id/tasks', teamController.createTeamTask);
router.patch('/:id/tasks/:taskId/status', teamController.updateTeamTaskStatus);

router.get('/:id/projects', teamController.getTeamProjects);
router.post('/:id/projects', teamController.createTeamProject);

router.get('/:id/activity', teamController.getTeamActivity);
router.get('/:id/progress', teamController.getTeamProgress);

router.get('/:id/collaborations', teamController.getCollaborations);
router.post('/:id/collaborations', teamController.createCollaboration);

export const teamRoutes = router;

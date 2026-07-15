import { Router } from 'express';
import { taskController } from './task.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

router.use(authGuard);

// Existing routes
router.get('/org', taskController.getTasksByOrganization as any);
router.get('/project/:projectId', taskController.getTasksByProject as any);
router.patch('/:taskId/status', taskController.updateTaskStatus as any);
router.post('/', taskController.createTask as any);

// Gantt-specific routes
router.get('/gantt', taskController.getGanttTasks as any);
router.post('/gantt', taskController.createGanttTask as any);
router.patch('/gantt/:taskId', taskController.updateGanttTask as any);
router.delete('/gantt/:taskId', taskController.deleteTask as any);

export const taskRoutes = router;

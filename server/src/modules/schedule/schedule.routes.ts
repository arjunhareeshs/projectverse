import { Router } from 'express';
import { scheduleController } from './schedule.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

router.use(authGuard);

router.get('/', scheduleController.getEvents as any);
router.post('/', scheduleController.createEvent as any);
router.delete('/:id', scheduleController.deleteEvent as any);

export const scheduleRoutes = router;

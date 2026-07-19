import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { notificationController } from './notification.controller';

const router = Router();

router.use(authGuard);

router.get('/', notificationController.getNotifications);
router.put('/:id/read', notificationController.markRead);
router.put('/read-all', notificationController.markAllRead);
router.post('/mock', notificationController.createMockNotification);

export default router;

import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

router.use(authGuard);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);
router.post('/mock', notificationController.createMockNotification);

export const notificationRoutes = router;

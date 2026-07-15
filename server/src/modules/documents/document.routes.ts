import { Router } from 'express';
import { documentController } from './document.controller';
import { authGuard } from '../../middleware/authGuard';
import { upload } from '../../infrastructure/storage/multer';

const router = Router();

router.use(authGuard);

router.get('/', documentController.getDocuments);
router.get('/download/:id', documentController.downloadFile);
router.post('/', documentController.createDocument);
router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.delete('/:id', documentController.deleteDocument);

export const documentRoutes = router;

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import { documentService } from './document.service';
import { notificationService } from '../notifications/notification.service';

export const documentController = {
  async getDocuments(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const projectId = req.query['projectId'] as string | undefined;
      const documents = await documentService.getDocuments(user.organizationId, projectId);
      res.json(documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch documents' });
    }
  },

  async createDocument(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      const { title, content, projectId } = req.body;
      if (!title) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Title is required' });
      }

      const document = await documentService.createDocument(user.id, {
        title,
        content,
        projectId,
      });

      // Create a notification for the user
      const targetSpace = projectId === 'global' || !projectId ? 'Global Space' : 'Project Space';
      await notificationService.createMockNotification(
        user.id,
        'Document Created',
        `You created a text document "${title}" in ${targetSpace}.`
      );

      res.status(StatusCodes.CREATED).json(document);
    } catch (error) {
      console.error('Error creating document:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create document' });
    }
  },

  async uploadDocument(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      const file = req.file;
      if (!file) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'No file uploaded' });
      }

      const projectId = req.body.projectId || null;
      const title = req.body.title || file.originalname;

      // Save file to the uploads directory
      const uploadDir = path.join(__dirname, '../../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
      const filePath = path.join(uploadDir, uniqueName);
      
      fs.writeFileSync(filePath, file.buffer);
      const fileUrl = `/uploads/${uniqueName}`;

      const document = await documentService.createDocument(user.id, {
        title,
        projectId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileUrl,
      });

      // Create a notification for the user
      const targetSpace = projectId === 'global' || !projectId ? 'Global Space' : 'Project Space';
      await notificationService.createMockNotification(
        user.id,
        'Document Uploaded',
        `File "${file.originalname}" was successfully ingested into ${targetSpace}.`
      );

      res.status(StatusCodes.CREATED).json(document);
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to upload document' });
    }
  },

  async deleteDocument(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      const id = req.params['id'] as string;
      await documentService.deleteDocument(user.id, user.role, id);
      res.json({ success: true });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to delete document';
      if (errMsg === 'Unauthorized to delete this document') {
        return res.status(StatusCodes.FORBIDDEN).json({ message: errMsg });
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: errMsg });
    }
  },

  async downloadFile(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      const id = req.params['id'] as string;
      const document = await documentService.getDocumentById(id);
      if (!document) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Document not found' });
      }

      if (!document.fileUrl) {
        res.setHeader('Content-Type', 'text/plain;charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.title.replace(/\s+/g, '_'))}.txt"`);
        return res.send(document.content || '');
      }

      const uploadDir = path.join(__dirname, '../../../uploads');
      const fileName = path.basename(document.fileUrl);
      const filePath = path.join(uploadDir, fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'File not found on server' });
      }

      return res.download(filePath, document.fileName || document.title);
    } catch (error) {
      console.error('Error downloading document:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to download document' });
    }
  },
};

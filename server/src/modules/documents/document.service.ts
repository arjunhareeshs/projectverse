import { prisma } from '../../shared/database';

export const documentService = {
  async getDocuments(organizationId: string, projectId?: string) {
    if (projectId === 'global') {
      return prisma.document.findMany({
        where: {
          projectId: null,
          user: {
            organizationId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (projectId) {
      return prisma.document.findMany({
        where: {
          projectId,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Default: fetch all documents in the user's organization (both global and project-wise)
    return prisma.document.findMany({
      where: {
        user: {
          organizationId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createDocument(
    userId: string,
    data: {
      title: string;
      content?: string;
      projectId?: string | null;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      fileUrl?: string;
    }
  ) {
    const projId = data.projectId === 'global' || !data.projectId ? null : data.projectId;

    return prisma.document.create({
      data: {
        title: data.title,
        content: data.content || null,
        projectId: projId,
        userId,
        fileName: data.fileName || null,
        fileSize: data.fileSize || null,
        mimeType: data.mimeType || null,
        fileUrl: data.fileUrl || null,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async deleteDocument(userId: string, userRole: string, id: string) {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new Error('Document not found');

    // Only creator or admin can delete
    if (doc.userId !== userId && userRole !== 'ADMIN') {
      throw new Error('Unauthorized to delete this document');
    }

    return prisma.document.delete({ where: { id } });
  },

  async getDocumentById(id: string) {
    return prisma.document.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },
};

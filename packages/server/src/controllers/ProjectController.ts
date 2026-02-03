// packages/server/src/controllers/ProjectController.ts
import { Request, Response } from 'express';
import { ProjectService } from '../services/ProjectService';
import { FileService } from '../services/FileService';
import { createAuditLog } from '../services/AuditService';
import multer from 'multer';
import path from 'path';

// Настройка multer для загрузки файлов
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB максимум на файл
  }
});

export class ProjectController {
  /**
   * GET /api/projects
   * Получить список проектов организации
   */
  static async listProjects(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { search, tags, isPublished } = req.query;

      const filters: any = {};
      if (search) filters.search = search as string;
      if (tags) filters.tags = (tags as string).split(',');
      if (isPublished !== undefined) filters.isPublished = isPublished === 'true';

      const projects = await ProjectService.getProjectsByOrganization(
        req.client.organizationId,
        filters
      );

      return res.json({
        success: true,
        count: projects.length,
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          thumbnail: p.thumbnail,
          tags: p.tags,
          canvasWidth: p.canvasWidth,
          canvasHeight: p.canvasHeight,
          totalFiles: p.totalFiles,
          totalStorageUsed: Number(p.totalStorageUsed),
          viewCount: p.viewCount,
          isPublished: p.isPublished,
          publishedAt: p.publishedAt,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          lastEditedAt: p.lastEditedAt,
          createdBy: p.createdByUser
        }))
      });

    } catch (error) {
      console.error('List projects error:', error);
      return res.status(500).json({
        error: 'Failed to list projects',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/projects
   * Создать новый проект
   */
  static async createProject(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const {
        name,
        description,
        projectData,
        canvasWidth,
        canvasHeight,
        canvasBackground,
        tags
      } = req.body;

      if (!name) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Project name is required'
        });
      }

      if (!projectData) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Project data is required'
        });
      }

      const project = await ProjectService.createProject({
        name,
        description,
        licenseId: req.client.licenseId,
        organizationId: req.client.organizationId,
        createdByUserId: req.client.userId || '',
        projectData,
        canvasWidth,
        canvasHeight,
        canvasBackground,
        tags
      });

      await createAuditLog({
        action: 'project_created',
        userId: req.client.userId,
        licenseId: req.client.licenseId,
        details: {
          projectId: project.id,
          projectName: name
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(201).json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          projectData: project.projectData,
          canvasWidth: project.canvasWidth,
          canvasHeight: project.canvasHeight,
          canvasBackground: project.canvasBackground,
          tags: project.tags,
          createdAt: project.createdAt
        }
      });

    } catch (error) {
      console.error('Create project error:', error);
      return res.status(500).json({
        error: 'Failed to create project',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/projects/:id
   * Получить проект по ID
   */
  static async getProject(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;

      const project = await ProjectService.getProjectById(id, req.client.organizationId);

      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
          message: 'Project does not exist or you do not have access'
        });
      }

      // Увеличиваем счётчик просмотров (асинхронно, не ждём)
      ProjectService.incrementViewCount(id).catch(console.error);

      return res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          projectData: project.projectData,
          canvasWidth: project.canvasWidth,
          canvasHeight: project.canvasHeight,
          canvasBackground: project.canvasBackground,
          version: project.version,
          thumbnail: project.thumbnail,
          tags: project.tags,
          totalFiles: project.totalFiles,
          totalStorageUsed: Number(project.totalStorageUsed),
          viewCount: project.viewCount,
          isPublished: project.isPublished,
          publishedAt: project.publishedAt,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          lastEditedAt: project.lastEditedAt,
          createdBy: project.createdByUser,
          files: project.files.map(f => ({
            id: f.id,
            fileName: f.fileName,
            fileType: f.fileType,
            mimeType: f.mimeType,
            fileSize: Number(f.fileSize),
            url: f.url,
            width: f.width,
            height: f.height,
            duration: f.duration,
            thumbnail: f.thumbnail,
            createdAt: f.createdAt
          }))
        }
      });

    } catch (error) {
      console.error('Get project error:', error);
      return res.status(500).json({
        error: 'Failed to get project',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /api/projects/:id
   * Обновить проект
   */
  static async updateProject(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const updates = req.body;

      const project = await ProjectService.updateProject(
        id,
        req.client.organizationId,
        updates
      );

      await createAuditLog({
        action: 'project_updated',
        userId: req.client.userId,
        licenseId: req.client.licenseId,
        details: {
          projectId: id,
          projectName: project.name,
          updates: Object.keys(updates)
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          projectData: project.projectData,
          lastEditedAt: project.lastEditedAt,
          updatedAt: project.updatedAt
        }
      });

    } catch (error) {
      console.error('Update project error:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Project not found',
          message: error.message
        });
      }

      return res.status(500).json({
        error: 'Failed to update project',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /api/projects/:id
   * Удалить проект
   */
  static async deleteProject(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;

      // Сначала удаляем все файлы проекта
      await FileService.deleteAllProjectFiles(id);

      // Затем удаляем сам проект
      await ProjectService.deleteProject(id, req.client.organizationId);

      await createAuditLog({
        action: 'project_deleted',
        userId: req.client.userId,
        licenseId: req.client.licenseId,
        details: {
          projectId: id
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: 'Project deleted successfully'
      });

    } catch (error) {
      console.error('Delete project error:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Project not found',
          message: error.message
        });
      }

      return res.status(500).json({
        error: 'Failed to delete project',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Экспортируем multer middleware для роутов
  static uploadMiddleware = upload.single('file');
}

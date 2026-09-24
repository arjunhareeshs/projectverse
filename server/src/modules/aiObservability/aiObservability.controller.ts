import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { aiObservabilityService } from './aiObservability.service';

function parseDays(req: Request): number {
  const days = Number(req.query.days);
  return Number.isFinite(days) && days > 0 ? days : 30;
}

export const aiObservabilityController = {
  async getOverview(req: Request, res: Response) {
    try {
      const data = await aiObservabilityService.getOverview(parseDays(req));
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  async getTimeseries(req: Request, res: Response) {
    try {
      const bucket = req.query.bucket === 'hour' ? 'hour' : 'day';
      const data = await aiObservabilityService.getUsageTimeseries(parseDays(req), bucket);
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  async getUsersByUsage(req: Request, res: Response) {
    try {
      const limit = Number(req.query.limit) || 50;
      const data = await aiObservabilityService.getUsageByUser(parseDays(req), limit);
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  async getRecentLogs(req: Request, res: Response) {
    try {
      const limit = Number(req.query.limit) || 100;
      const data = await aiObservabilityService.getRecentUsageLogs(limit);
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  async getSystemLogs(req: Request, res: Response) {
    try {
      const limit = Number(req.query.limit) || 200;
      const level = req.query.level as 'INFO' | 'WARN' | 'ERROR' | undefined;
      const source = req.query.source as string | undefined;
      const data = await aiObservabilityService.getSystemLogs({ limit, level, source });
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  async getProviderHealth(_req: Request, res: Response) {
    try {
      const data = await aiObservabilityService.getProviderHealth();
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },
};

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { observabilityService } from './observability.service';

function parseDays(req: Request, fallback = 1): number {
  const days = Number(req.query.days);
  return Number.isFinite(days) && days > 0 ? days : fallback;
}

function handle<T>(fn: (req: Request) => Promise<T>) {
  return async (req: Request, res: Response) => {
    try {
      res.json(await fn(req));
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  };
}

export const observabilityController = {
  getRequestOverview: handle((req) => observabilityService.getRequestOverview(parseDays(req))),
  getRequestsByRoute: handle((req) => observabilityService.getRequestsByRoute(parseDays(req))),
  getRequestTimeseries: handle((req) => observabilityService.getRequestTimeseries(Number(req.query.hours) || 24)),
  getStatusDistribution: handle((req) => observabilityService.getStatusDistribution(parseDays(req))),
  getErrorTimeseries: handle((req) => observabilityService.getErrorTimeseries(parseDays(req))),
  getRecentRequests: handle((req) => observabilityService.getRecentRequests(Number(req.query.limit) || 100)),
  getMetrics: handle((req) =>
    observabilityService.getMetrics(Number(req.query.hours) || 6, req.query.instance as string | undefined),
  ),
  getBackendErrors: handle((req) => observabilityService.getBackendErrors(Number(req.query.limit) || 100)),
  getClientErrors: handle((req) => observabilityService.getClientErrors(Number(req.query.limit) || 100)),
};

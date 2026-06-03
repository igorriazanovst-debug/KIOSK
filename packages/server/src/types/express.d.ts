import 'express';

declare global {
  namespace Express {
    interface Request {
      player?: { licenseId: string; deviceId: string; plan: string };
      client?: any;
    }
  }
}

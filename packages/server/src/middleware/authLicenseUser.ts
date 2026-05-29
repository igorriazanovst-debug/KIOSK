// src/middleware/authLicenseUser.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJWTConfig } from '../config/jwt';

export interface LicenseUserPayload {
  licenseUserId: string;
  licenseId: string;
  email: string;
  role: 'OWNER' | 'MEMBER';
  type: 'license_user';
}

declare global {
  namespace Express {
    interface Request {
      licenseUser?: LicenseUserPayload;
    }
  }
}

export const authenticateLicenseUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No authorization token' });
    }

    const token = authHeader.substring(7);
    const config = getJWTConfig();

    const decoded = jwt.verify(token, config.publicKey, {
      algorithms: [config.algorithm],
    }) as any;

    if (decoded.type !== 'license_user') {
      return res.status(403).json({ success: false, error: 'Invalid token type' });
    }

    req.licenseUser = decoded as LicenseUserPayload;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

export const requireOwner = (req: Request, res: Response, next: NextFunction) => {
  if (!req.licenseUser || req.licenseUser.role !== 'OWNER') {
    return res.status(403).json({ success: false, error: 'Owner role required' });
  }
  next();
};

// packages/server/src/config/jwt.ts

import fs from 'fs';
import path from 'path';

export interface JWTConfig {
  privateKey: string;
  publicKey: string;
  algorithm: 'RS256';
  expiresIn: string;
}

let jwtConfig: JWTConfig | null = null;

export function loadJWTConfig(): JWTConfig {
  if (jwtConfig) {
    return jwtConfig;
  }

  const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || path.join(__dirname, '../../keys/private.key');
  const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../../keys/public.key');

  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Private key not found at ${privateKeyPath}. Run: npm run generate-keys`);
  }

  if (!fs.existsSync(publicKeyPath)) {
    throw new Error(`Public key not found at ${publicKeyPath}. Run: npm run generate-keys`);
  }

  jwtConfig = {
    privateKey: fs.readFileSync(privateKeyPath, 'utf8'),
    publicKey: fs.readFileSync(publicKeyPath, 'utf8'),
    algorithm: 'RS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  };

  return jwtConfig;
}

export function getJWTConfig(): JWTConfig {
  if (!jwtConfig) {
    return loadJWTConfig();
  }
  return jwtConfig;
}

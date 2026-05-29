// src/routes/client.routes.ts
import { Router } from 'express';
import { ClientController } from '../controllers/ClientController';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateLicenseUser, requireOwner } from '../middleware/authLicenseUser';

const router = Router();

// POST /api/client/login — публичный
router.post('/login', asyncHandler(ClientController.login));

// Все остальные — требуют токен
router.use(authenticateLicenseUser);

router.get('/dashboard', asyncHandler(ClientController.dashboard));

router.get('/users', requireOwner, asyncHandler(ClientController.listUsers));
router.post('/users', requireOwner, asyncHandler(ClientController.createUser));
router.delete('/users/:id', requireOwner, asyncHandler(ClientController.deleteUser));

export default router;

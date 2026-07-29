import { Router } from 'express';
import { z } from 'zod';
import * as service from './auth.service';
import { requireAuth, type AuthenticatedRequest } from '../../middlewares/auth';

export const authRoutes = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres'),
  monthlyIncome: z.number().nonnegative().optional(),
  goal: z.enum(['exit_debts', 'control_spending', 'save_money', 'organize']).optional(),
  hasDebts: z.boolean().optional(),
});

authRoutes.post('/register', async (req, res, next) => {
  try {
    res.status(201).json(await service.register(registerSchema.parse(req.body)));
  } catch (e) { next(e); }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRoutes.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await service.login(email, password));
  } catch (e) { next(e); }
});

const googleSchema = z.object({ idToken: z.string().min(1) });

authRoutes.post('/google', async (req, res, next) => {
  try {
    const { idToken } = googleSchema.parse(req.body);
    res.json(await service.loginWithGoogle(idToken));
  } catch (e) { next(e); }
});

const appleSchema = z.object({
  identityToken: z.string().min(1),
  name: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }).optional(),
});

authRoutes.post('/apple', async (req, res, next) => {
  try {
    const { identityToken, name } = appleSchema.parse(req.body);
    res.json(await service.loginWithApple(identityToken, name));
  } catch (e) { next(e); }
});

authRoutes.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json(await service.getMe((req as AuthenticatedRequest).userId));
  } catch (e) { next(e); }
});

const profilePatchSchema = z.object({
  name: z.string().min(1).optional(),
  monthlyIncome: z.number().nonnegative().optional(),
  goal: z.enum(['exit_debts', 'control_spending', 'save_money', 'organize']).optional(),
  hasDebts: z.boolean().optional(),
  onboarded: z.boolean().optional(),
});

authRoutes.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const patch = profilePatchSchema.parse(req.body);
    res.json(await service.updateProfile((req as AuthenticatedRequest).userId, patch));
  } catch (e) { next(e); }
});

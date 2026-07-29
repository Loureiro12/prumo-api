import { Router } from 'express';
import { z } from 'zod';
import * as service from './auth.service';

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

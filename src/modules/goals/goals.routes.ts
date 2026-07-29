import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import type { AuthenticatedRequest } from '../../middlewares/auth';

export const goalsRoutes = Router();
const uid = (req: unknown): string => (req as AuthenticatedRequest).userId;

const schema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().nonnegative().default(0),
  deadline: z.string().datetime().optional(),
  accountId: z.string().optional(),
  icon: z.string().default('flag'),
});

goalsRoutes.get('/', async (req, res, next) => {
  try { res.json(await prisma.financialGoal.findMany({ where: { userId: uid(req) } })); }
  catch (e) { next(e); }
});

goalsRoutes.post('/', async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    res.status(201).json(await prisma.financialGoal.create({
      data: { ...data, userId: uid(req), deadline: data.deadline ? new Date(data.deadline) : null },
    }));
  } catch (e) { next(e); }
});

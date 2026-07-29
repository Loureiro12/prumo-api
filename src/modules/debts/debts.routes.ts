import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import type { AuthenticatedRequest } from '../../middlewares/auth';

export const debtsRoutes = Router();
const uid = (req: unknown): string => (req as AuthenticatedRequest).userId;

const schema = z.object({
  name: z.string().min(1),
  creditor: z.string().min(1),
  totalAmount: z.number().positive(),
  remainingAmount: z.number().nonnegative(),
  interestRate: z.number().nonnegative().optional(),
  installmentsTotal: z.number().int().positive(),
  installmentAmount: z.number().positive(),
  dueDate: z.string().datetime(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['open', 'negotiating', 'paid', 'late']).default('open'),
});

debtsRoutes.get('/', async (req, res, next) => {
  try { res.json(await prisma.debt.findMany({ where: { userId: uid(req) } })); }
  catch (e) { next(e); }
});

debtsRoutes.post('/', async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    res.status(201).json(await prisma.debt.create({
      data: { ...data, userId: uid(req), dueDate: new Date(data.dueDate) },
    }));
  } catch (e) { next(e); }
});

debtsRoutes.patch('/:id', async (req, res, next) => {
  try {
    const data = schema.partial().parse(req.body);
    await prisma.debt.updateMany({
      where: { id: req.params.id, userId: uid(req) },
      data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

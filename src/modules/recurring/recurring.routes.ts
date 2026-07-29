import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { dueRecurringForMonth } from '../../domain/finance';
import type { AuthenticatedRequest } from '../../middlewares/auth';

export const recurringRoutes = Router();
const uid = (req: unknown): string => (req as AuthenticatedRequest).userId;

const schema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().optional(),
  dueDay: z.number().int().min(1).max(28),
  frequency: z.enum(['weekly', 'monthly', 'yearly', 'custom']).default('monthly'),
  paymentMethod: z.enum(['account', 'credit_card']).default('account'),
  accountId: z.string().optional(),
  creditCardId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

recurringRoutes.get('/', async (req, res, next) => {
  try {
    res.json(await prisma.recurringTransaction.findMany({ where: { userId: uid(req) } }));
  } catch (e) { next(e); }
});

recurringRoutes.post('/', async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    res.status(201).json(await prisma.recurringTransaction.create({
      data: {
        ...data, userId: uid(req),
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    }));
  } catch (e) { next(e); }
});

/** Regra 7: gera os lançamentos pendentes do mês corrente para as contas fixas ativas. */
recurringRoutes.post('/generate', async (req, res, next) => {
  try {
    const userId = uid(req);
    const month = new Date().toISOString().slice(0, 7);
    const [recurring, existing] = await Promise.all([
      prisma.recurringTransaction.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId, recurringId: { not: null } } }),
    ]);
    const due = dueRecurringForMonth(recurring, existing, month);
    const created = await prisma.$transaction(
      due.map((d) => prisma.transaction.create({ data: { ...d, userId } })),
    );
    res.status(201).json(created);
  } catch (e) { next(e); }
});

recurringRoutes.delete('/:id', async (req, res, next) => {
  try {
    await prisma.recurringTransaction.updateMany({
      where: { id: req.params.id, userId: uid(req) },
      data: { active: false },
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

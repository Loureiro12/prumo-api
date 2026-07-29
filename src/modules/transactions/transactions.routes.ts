import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import * as service from './transactions.service';

export const transactionsRoutes = Router();

const uid = (req: unknown): string => (req as AuthenticatedRequest).userId;

transactionsRoutes.get('/', async (req, res, next) => {
  try {
    const filters = z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      type: z.enum(['income', 'expense', 'transfer']).optional(),
      accountId: z.string().optional(),
      creditCardId: z.string().optional(),
      search: z.string().optional(),
    }).parse(req.query);
    res.json(await service.list(uid(req), filters));
  } catch (e) { next(e); }
});

const expenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  categoryId: z.string().optional(),
  date: z.string().datetime(),
  paymentMethod: z.enum(['account', 'credit_card']),
  accountId: z.string().optional(),
  creditCardId: z.string().optional(),
  installments: z.number().int().min(2).max(48).optional(),
  note: z.string().optional(),
  status: z.enum(['paid', 'pending']).optional(),
});

transactionsRoutes.post('/expenses', async (req, res, next) => {
  try {
    res.status(201).json(await service.createExpense(uid(req), expenseSchema.parse(req.body)));
  } catch (e) { next(e); }
});

const incomeSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  categoryId: z.string().optional(),
  date: z.string().datetime(),
  accountId: z.string().min(1),
  status: z.enum(['paid', 'pending']).optional(),
});

transactionsRoutes.post('/incomes', async (req, res, next) => {
  try {
    res.status(201).json(await service.createIncome(uid(req), incomeSchema.parse(req.body)));
  } catch (e) { next(e); }
});

const transferSchema = z.object({
  amount: z.number().positive(),
  accountId: z.string().min(1),
  toAccountId: z.string().min(1),
  date: z.string().datetime(),
}).refine((d) => d.accountId !== d.toAccountId, {
  message: 'A conta de destino deve ser diferente da origem',
});

transactionsRoutes.post('/transfers', async (req, res, next) => {
  try {
    res.status(201).json(await service.createTransfer(uid(req), transferSchema.parse(req.body)));
  } catch (e) { next(e); }
});

transactionsRoutes.patch('/:id/pay', async (req, res, next) => {
  try {
    res.json(await service.markAsPaid(uid(req), req.params.id));
  } catch (e) { next(e); }
});

transactionsRoutes.delete('/:id', async (req, res, next) => {
  try {
    await service.remove(uid(req), req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

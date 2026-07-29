import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import * as service from './cards.service';

export const cardsRoutes = Router();
const uid = (req: unknown): string => (req as AuthenticatedRequest).userId;

const cardSchema = z.object({
  name: z.string().min(1),
  institution: z.string().min(1),
  limit: z.number().positive(),
  closingDay: z.number().int().min(1).max(28),
  dueDay: z.number().int().min(1).max(28),
  color: z.string().min(1),
  lastFourDigits: z.string().regex(/^\d{4}$/).optional(),
});

cardsRoutes.get('/', async (req, res, next) => {
  try { res.json(await service.listWithUsage(uid(req))); } catch (e) { next(e); }
});

cardsRoutes.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await service.create(uid(req), cardSchema.parse(req.body)));
  } catch (e) { next(e); }
});

cardsRoutes.get('/invoices/:invoiceId', async (req, res, next) => {
  try {
    res.json(await service.invoiceDetail(uid(req), req.params.invoiceId));
  } catch (e) { next(e); }
});

cardsRoutes.post('/invoices/:invoiceId/pay', async (req, res, next) => {
  try {
    const { accountId } = z.object({ accountId: z.string().min(1) }).parse(req.body);
    res.json(await service.payInvoice(uid(req), req.params.invoiceId, accountId));
  } catch (e) { next(e); }
});

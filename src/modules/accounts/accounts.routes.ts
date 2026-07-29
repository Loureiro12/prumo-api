import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import * as service from './accounts.service';

const uid = (req: unknown): string => uid(req);

export const accountsRoutes = Router();

const accountSchema = z.object({
  name: z.string().min(1),
  institution: z.string().min(1),
  type: z.enum(['checking', 'savings', 'wallet', 'cash', 'investment', 'other']),
  initialBalance: z.number(),
  color: z.string().min(1),
  icon: z.string().min(1),
});

accountsRoutes.get('/', async (req, res, next) => {
  try {
    res.json(await service.listWithBalances(uid(req)));
  } catch (e) { next(e); }
});

accountsRoutes.post('/', async (req, res, next) => {
  try {
    const data = accountSchema.parse(req.body);
    res.status(201).json(await service.create(uid(req), data));
  } catch (e) { next(e); }
});

accountsRoutes.patch('/:id', async (req, res, next) => {
  try {
    const data = accountSchema.partial().parse(req.body);
    res.json(await service.update(uid(req), req.params.id, data));
  } catch (e) { next(e); }
});

accountsRoutes.delete('/:id', async (req, res, next) => {
  try {
    await service.archive(uid(req), req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
});
